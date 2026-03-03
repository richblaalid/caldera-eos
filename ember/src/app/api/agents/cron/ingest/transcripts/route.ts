import { NextRequest, NextResponse } from 'next/server'
import { transcriptConnector } from '@/lib/connectors/transcript-connector'
import { listMeetings, fetchTranscript, fetchNotes, fetchCoaching } from '@/lib/connectors/grain-mcp-client'
import type { GrainTokenConfig } from '@/lib/connectors/grain-mcp-client'
import { parseGrainNotes } from '@/lib/connectors/grain-notes-parser'
import { verifyCronAuth, loadPartners, persistRecords, supabaseAdmin } from '@/lib/agents/ingest-helpers'
import { generateL10Recap, hasL10RecapBeenGenerated, formatL10RecapBlocks, formatPersonalL10Blocks } from '@/lib/agents/l10-recap'
import { getSlackClient, postBlockMessage, openDM } from '@/lib/connectors/slack-connector'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(request: NextRequest) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const { data: partners, error: fetchError } = await loadPartners()
    if (fetchError || !partners) {
      return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 })
    }

    const results = {
      grain_meetings_discovered: 0,
      grain_transcripts_ingested: 0,
      grain_notes_used: 0,
      grain_coaching_ingested: 0,
      ingested_data_records: 0,
      l10_recaps_sent: 0,
      l10_items_created: 0,
      errors: [] as string[],
    }
    const processedOrgs = new Set<string>()

    for (const partner of partners) {
      if (processedOrgs.has(partner.organization_id)) continue
      processedOrgs.add(partner.organization_id)

      const config = (partner.config as Record<string, unknown>) || {}

      // Build Grain token config from DB (preferred) or env vars (fallback)
      const grainTokenConfig: GrainTokenConfig | undefined =
        (partner.grain_refresh_token && partner.grain_client_id)
          ? { refreshToken: partner.grain_refresh_token, clientId: partner.grain_client_id }
          : undefined

      // Phase 1: Discover and ingest new meetings from Grain MCP
      try {
        const grainResult = await ingestFromGrainMcp(
          partner.organization_id,
          config.grain_last_sync as string | undefined,
          grainTokenConfig,
        )
        results.grain_meetings_discovered += grainResult.discovered
        results.grain_transcripts_ingested += grainResult.ingested
        results.grain_notes_used += grainResult.notesUsed
        results.grain_coaching_ingested += grainResult.coachingIngested
        results.errors.push(...grainResult.errors)

        // Persist rotated refresh token if it changed
        if (grainResult.newRefreshToken) {
          await supabaseAdmin
            .from('partner_preferences')
            .update({ grain_refresh_token: grainResult.newRefreshToken })
            .eq('partner_id', partner.partner_id)
            .eq('organization_id', partner.organization_id)
          console.log('Grain: persisted rotated refresh token')
        }

        // Update grain_last_sync if we discovered meetings
        if (grainResult.discovered > 0) {
          const updatedConfig = { ...config, grain_last_sync: new Date().toISOString() }
          await supabaseAdmin
            .from('partner_preferences')
            .update({ config: updatedConfig })
            .eq('partner_id', partner.partner_id)
            .eq('organization_id', partner.organization_id)
        }
      } catch (err: unknown) {
        const message = (err as Error).message || 'Grain MCP failed'
        results.errors.push(`GrainMCP(${partner.organization_id}): ${message}`)
        console.error('Grain MCP ingestion error:', message)
      }

      // Phase 2: Run existing transcript connector (reads processed transcripts → ingested_data)
      try {
        const transcriptResult = await transcriptConnector.pull({
          organizationId: partner.organization_id,
          partnerId: partner.partner_id,
          config: { grain_last_sync: config.grain_last_sync },
        })

        if (transcriptResult.records.length > 0) {
          const err = await persistRecords(transcriptResult.records, partner.organization_id)
          if (err) results.errors.push(`Persist(${partner.organization_id}): ${err}`)
        }
        results.ingested_data_records += transcriptResult.records.length

        if (transcriptResult.errors.length > 0) {
          results.errors.push(...transcriptResult.errors.map(e => `Transcript(${partner.organization_id}): ${e.message}`))
        }

        // Update grain_last_sync from transcript connector
        if (transcriptResult.syncState?.grain_last_sync) {
          const updatedConfig = {
            ...config,
            grain_last_sync: transcriptResult.syncState.grain_last_sync,
          }
          await supabaseAdmin
            .from('partner_preferences')
            .update({ config: updatedConfig })
            .eq('partner_id', partner.partner_id)
            .eq('organization_id', partner.organization_id)
        }
      } catch (err: unknown) {
        results.errors.push(`Transcript(${partner.organization_id}): ${(err as Error).message || 'Connector crashed'}`)
      }
    }

    // Phase 3: Check for newly-ingested L10 transcripts and generate recaps
    if (results.grain_transcripts_ingested > 0) {
      try {
        const recapResults = await processL10Recaps(processedOrgs)
        results.l10_recaps_sent += recapResults.recapsSent
        results.l10_items_created += recapResults.itemsCreated
        results.errors.push(...recapResults.errors)
      } catch (err: unknown) {
        results.errors.push(`L10Recap: ${(err as Error).message || 'Recap processing failed'}`)
      }
    }

    console.log('Transcript ingestion complete:', results)
    return NextResponse.json({ message: 'Transcript ingestion complete', ...results })
  } catch (error) {
    console.error('Transcript ingestion cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Discover new meetings from Grain MCP, fetch transcripts + notes,
 * and insert them into the transcripts table.
 */
async function ingestFromGrainMcp(
  organizationId: string,
  lastSync?: string,
  tokenConfig?: GrainTokenConfig,
): Promise<{ discovered: number; ingested: number; notesUsed: number; coachingIngested: number; newRefreshToken?: string; errors: string[] }> {
  const errors: string[] = []

  // Skip if Grain MCP is not configured (no DB tokens and no env vars)
  if (!tokenConfig && !process.env.GRAIN_MCP_TOKEN && !process.env.GRAIN_MCP_REFRESH_TOKEN) {
    return { discovered: 0, ingested: 0, notesUsed: 0, coachingIngested: 0, errors: [] }
  }

  // Discover meetings since last sync
  const listResult = await listMeetings(lastSync, tokenConfig)
  const meetings = listResult.meetings
  const newRefreshToken = listResult.newRefreshToken
  if (meetings.length === 0) {
    return { discovered: 0, ingested: 0, notesUsed: 0, coachingIngested: 0, newRefreshToken, errors: [] }
  }

  console.log(`Grain MCP: discovered ${meetings.length} meetings since ${lastSync || 'beginning'}`)

  // Check which meetings are already in the transcripts table
  const { data: existingTranscripts } = await supabaseAdmin
    .from('transcripts')
    .select('title, meeting_date')
    .eq('organization_id', organizationId)
    .eq('source', 'grain')

  const existingKeys = new Set(
    (existingTranscripts || []).map(t => `${t.title}::${t.meeting_date}`)
  )

  let ingested = 0
  let notesUsed = 0
  let coachingIngested = 0

  for (const meeting of meetings) {
    // Skip if already ingested (match on title + date)
    const meetingKey = `${meeting.title}::${meeting.date}`
    if (existingKeys.has(meetingKey)) continue

    try {
      // Fetch transcript
      const transcript = await fetchTranscript(meeting.id, tokenConfig)
      if (!transcript || transcript.text.trim().length === 0) {
        console.log(`Grain MCP: no transcript for "${meeting.title}", skipping`)
        continue
      }

      // Fetch AI notes (may not exist for all meetings)
      let extractions = null
      const notes = await fetchNotes(meeting.id, tokenConfig)
      if (notes && notes.markdown.trim().length > 0) {
        extractions = parseGrainNotes(notes.markdown)
        notesUsed++
      }

      // Insert into transcripts table
      const { error: insertError } = await supabaseAdmin
        .from('transcripts')
        .insert({
          title: meeting.title,
          meeting_date: meeting.date || null,
          participants: transcript.speakers || meeting.participants || [],
          full_text: transcript.text,
          summary: extractions?.summary || null,
          source: 'grain',
          processed: false,
          extractions: extractions || null,
          organization_id: organizationId,
        })

      if (insertError) {
        errors.push(`GrainInsert(${meeting.title}): ${insertError.message}`)
      } else {
        ingested++
        console.log(`Grain MCP: ingested "${meeting.title}" (notes: ${notes ? 'yes' : 'no'})`)
      }

      // Fetch and persist coaching feedback (separate from transcript)
      const coachingResult = await ingestCoachingFeedback(organizationId, meeting, tokenConfig)
      if (coachingResult.ingested) coachingIngested++
      if (coachingResult.error) errors.push(coachingResult.error)
    } catch (err: unknown) {
      errors.push(`GrainFetch(${meeting.title}): ${(err as Error).message}`)
    }
  }

  return { discovered: meetings.length, ingested, notesUsed, coachingIngested, newRefreshToken, errors }
}

/**
 * Phase 3: Detect newly-ingested L10 transcripts, generate recaps,
 * create EOS items, and deliver via Slack.
 */
async function processL10Recaps(
  processedOrgs: Set<string>,
): Promise<{ recapsSent: number; itemsCreated: number; errors: string[] }> {
  const errors: string[] = []
  let recapsSent = 0
  let itemsCreated = 0

  for (const organizationId of processedOrgs) {
    // Find L10 transcripts that were just ingested (unprocessed, source='grain', title matches L10)
    const { data: l10Transcripts } = await supabaseAdmin
      .from('transcripts')
      .select('id, title, meeting_date')
      .eq('organization_id', organizationId)
      .eq('source', 'grain')
      .eq('processed', false)
      .or('title.ilike.%l10%,title.ilike.%level 10%,title.ilike.%level ten%')
      .order('meeting_date', { ascending: false })
      .limit(3)

    if (!l10Transcripts || l10Transcripts.length === 0) continue

    for (const transcript of l10Transcripts) {
      // Dedup: skip if recap already generated for this transcript
      const alreadyDone = await hasL10RecapBeenGenerated(organizationId, transcript.id)
      if (alreadyDone) continue

      try {
        console.log(`L10 Recap: generating for "${transcript.title}"`)
        const result = await generateL10Recap(organizationId, transcript.id)

        // Deliver recap to #caldera-eos channel
        const channelId = await getDefaultChannelId(organizationId)
        if (channelId) {
          const client = await getSlackClient(organizationId)
          if (client) {
            const blocks = formatL10RecapBlocks(result.recap, {
              issuesCreated: result.issuesCreated,
              todosCreated: result.todosCreated,
            })
            await postBlockMessage(client, channelId, `L10 Recap — ${transcript.title}`, blocks)
            recapsSent++

            // DM each partner their personal action items
            for (const [ownerId, items] of result.itemsByOwner) {
              if (ownerId === 'unassigned' || items.length === 0) continue

              const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('slack_user_id, full_name')
                .eq('id', ownerId)
                .single()

              if (profile?.slack_user_id) {
                const dmChannel = await openDM(client, profile.slack_user_id)
                if (dmChannel) {
                  const personalBlocks = formatPersonalL10Blocks(profile.full_name || 'Partner', items)
                  await postBlockMessage(client, dmChannel, 'Your L10 Action Items', personalBlocks)
                }
              }
            }
          }
        }

        itemsCreated += result.issuesCreated + result.todosCreated
        console.log(`L10 Recap: sent for "${transcript.title}" — ${result.issuesCreated} issues, ${result.todosCreated} todos`)
      } catch (err: unknown) {
        errors.push(`L10Recap(${transcript.title}): ${(err as Error).message}`)
      }
    }
  }

  return { recapsSent, itemsCreated, errors }
}

/**
 * Get the default Slack channel ID for an organization (from any partner's slack_settings).
 */
async function getDefaultChannelId(organizationId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('partner_preferences')
    .select('config')
    .eq('organization_id', organizationId)
    .not('config', 'is', null)
    .limit(3)

  for (const row of data || []) {
    const config = row.config as Record<string, unknown> | null
    const slackSettings = config?.slack_settings as Record<string, unknown> | null
    if (slackSettings?.default_channel_id) {
      return slackSettings.default_channel_id as string
    }
  }
  return null
}

/**
 * Fetch coaching feedback for a meeting and persist to ingested_data.
 * Coaching data is stored separately from the transcript since it has
 * a different data_type and is consumed by different agents.
 */
async function ingestCoachingFeedback(
  organizationId: string,
  meeting: { id: string; title: string; date: string; participants?: string[] },
  tokenConfig?: GrainTokenConfig,
): Promise<{ ingested: boolean; error?: string }> {
  try {
    const coaching = await fetchCoaching(meeting.id, tokenConfig)
    if (!coaching || !coaching.markdown.trim()) {
      return { ingested: false }
    }

    const { error } = await supabaseAdmin
      .from('ingested_data')
      .upsert({
        organization_id: organizationId,
        source: 'grain',
        source_id: `coaching-${meeting.id}`,
        data_type: 'coaching_feedback',
        payload: {
          meeting_title: meeting.title,
          meeting_id: meeting.id,
          meeting_date: meeting.date,
          participants: meeting.participants || [],
          coaching_markdown: coaching.markdown,
        },
        entities: {
          people: meeting.participants || [],
        },
        relevance_tags: ['coaching', 'sales'],
        source_timestamp: meeting.date || new Date().toISOString(),
      }, {
        onConflict: 'organization_id,source,source_id',
      })

    if (error) {
      return { ingested: false, error: `CoachingPersist(${meeting.title}): ${error.message}` }
    }

    console.log(`Grain MCP: coaching ingested for "${meeting.title}"`)
    return { ingested: true }
  } catch {
    // Coaching feedback may not exist for all meetings — graceful skip
    return { ingested: false }
  }
}
