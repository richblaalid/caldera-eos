import { NextRequest, NextResponse } from 'next/server'
import { transcriptConnector } from '@/lib/connectors/transcript-connector'
import { listMeetings, fetchTranscript, fetchNotes, fetchCoaching } from '@/lib/connectors/grain-mcp-client'
import { parseGrainNotes } from '@/lib/connectors/grain-notes-parser'
import { verifyCronAuth, loadPartners, persistRecords, supabaseAdmin } from '@/lib/agents/ingest-helpers'

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
      errors: [] as string[],
    }
    const processedOrgs = new Set<string>()

    for (const partner of partners) {
      if (processedOrgs.has(partner.organization_id)) continue
      processedOrgs.add(partner.organization_id)

      const config = (partner.config as Record<string, unknown>) || {}

      // Phase 1: Discover and ingest new meetings from Grain MCP
      try {
        const grainResult = await ingestFromGrainMcp(
          partner.organization_id,
          config.grain_last_sync as string | undefined,
        )
        results.grain_meetings_discovered += grainResult.discovered
        results.grain_transcripts_ingested += grainResult.ingested
        results.grain_notes_used += grainResult.notesUsed
        results.grain_coaching_ingested += grainResult.coachingIngested
        results.errors.push(...grainResult.errors)

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
): Promise<{ discovered: number; ingested: number; notesUsed: number; coachingIngested: number; errors: string[] }> {
  const errors: string[] = []

  // Skip if Grain MCP is not configured
  if (!process.env.GRAIN_MCP_TOKEN && !process.env.GRAIN_MCP_REFRESH_TOKEN) {
    return { discovered: 0, ingested: 0, notesUsed: 0, coachingIngested: 0, errors: [] }
  }

  // Discover meetings since last sync
  const meetings = await listMeetings(lastSync)
  if (meetings.length === 0) {
    return { discovered: 0, ingested: 0, notesUsed: 0, coachingIngested: 0, errors: [] }
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
      const transcript = await fetchTranscript(meeting.id)
      if (!transcript || transcript.text.trim().length === 0) {
        console.log(`Grain MCP: no transcript for "${meeting.title}", skipping`)
        continue
      }

      // Fetch AI notes (may not exist for all meetings)
      let extractions = null
      const notes = await fetchNotes(meeting.id)
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
      const coachingResult = await ingestCoachingFeedback(organizationId, meeting)
      if (coachingResult.ingested) coachingIngested++
      if (coachingResult.error) errors.push(coachingResult.error)
    } catch (err: unknown) {
      errors.push(`GrainFetch(${meeting.title}): ${(err as Error).message}`)
    }
  }

  return { discovered: meetings.length, ingested, notesUsed, coachingIngested, errors }
}

/**
 * Fetch coaching feedback for a meeting and persist to ingested_data.
 * Coaching data is stored separately from the transcript since it has
 * a different data_type and is consumed by different agents.
 */
async function ingestCoachingFeedback(
  organizationId: string,
  meeting: { id: string; title: string; date: string; participants?: string[] },
): Promise<{ ingested: boolean; error?: string }> {
  try {
    const coaching = await fetchCoaching(meeting.id)
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
