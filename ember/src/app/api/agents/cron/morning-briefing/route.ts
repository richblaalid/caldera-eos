import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateBriefing, saveBriefing } from '@/lib/agents/ea-briefing'
import { deliverBriefing } from '@/lib/agents/slack-briefing'
import { postSystemAlert, getSlackClient, openDM, postBlockMessage } from '@/lib/connectors/slack-connector'
import { generatePreCallBrief } from '@/lib/agents/meeting-prep'
import { runNudgeCheck, formatNudgeForSlack, type Nudge } from '@/lib/agents/nudge-engine'
import { detectUpcomingL10, hasL10PrepBeenGenerated, generateL10Prep, type L10Prep } from '@/lib/agents/l10-prep'
import { escapeSlackMrkdwn, truncateForSlack, chunkForSlackSections, slackDate } from '@/lib/slack-format'
import { verifyCronAuth } from '@/lib/agents/ingest-helpers'
// briefing types inferred from generateBriefing() return type

const esc = escapeSlackMrkdwn

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/agents/cron/morning-briefing
// Runs weekday mornings to generate and deliver briefings to each partner.
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify cron secret
    const authError = verifyCronAuth(request)
    if (authError) return authError

    // Get all partners with preferences
    const { data: partners, error: fetchError } = await supabaseAdmin
      .from('partner_preferences')
      .select('partner_id, organization_id, briefing_time, briefing_timezone')

    if (fetchError) {
      console.error('Failed to fetch partner preferences:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 })
    }

    if (!partners || partners.length === 0) {
      return NextResponse.json({ message: 'No partners with preferences configured', briefings: 0 })
    }

    const results = {
      partners_processed: 0,
      briefings_generated: 0,
      briefings_delivered: 0,
      prep_briefs_sent: 0,
      nudges_sent: 0,
      nudge_issues_created: 0,
      l10_prep_generated: false,
      errors: [] as string[],
    }

    // Step 1: Run nudge check once per organization (before briefing generation)
    const nudgesByPartner = new Map<string, Nudge[]>()
    const nudgedOrgs = new Set<string>()

    for (const partner of partners) {
      if (nudgedOrgs.has(partner.organization_id)) continue
      nudgedOrgs.add(partner.organization_id)
      try {
        const nudgeResult = await runNudgeCheck(partner.organization_id)
        results.nudge_issues_created += nudgeResult.issuesCreated

        for (const nudge of nudgeResult.nudges) {
          const existing = nudgesByPartner.get(nudge.targetPartnerId) || []
          existing.push(nudge)
          nudgesByPartner.set(nudge.targetPartnerId, existing)
        }

        if (nudgeResult.errors.length > 0) {
          results.errors.push(...nudgeResult.errors.map(e => `Nudge: ${e}`))
        }
      } catch (nudgeError: unknown) {
        const nErr = nudgeError as { message?: string }
        results.errors.push(`Nudge engine: ${nErr.message || 'Unknown error'}`)
      }
    }

    // Step 2: Generate all briefings in parallel (the expensive Sonnet calls)
    const briefingResults = await Promise.allSettled(
      partners.map(partner =>
        generateBriefing(partner.partner_id, partner.organization_id, partner.briefing_timezone || 'America/Chicago')
          .then(briefing => ({ partner, briefing }))
      )
    )

    // Step 3: Save and deliver each briefing (sequential for Slack rate limits)
    for (const result of briefingResults) {
      if (result.status === 'rejected') {
        results.errors.push(`Briefing generation: ${result.reason?.message || 'Unknown error'}`)
        continue
      }

      const { partner, briefing } = result.value

      try {
        // Save to database
        const briefingId = await saveBriefing(briefing)
        if (!briefingId) {
          results.errors.push(`Save failed for ${partner.partner_id}`)
          continue
        }

        results.briefings_generated++

        // Deliver via Slack
        const delivered = await deliverBriefing(
          partner.partner_id,
          partner.organization_id,
          briefingId,
          briefing,
          partner.briefing_timezone || 'America/Chicago'
        )

        if (delivered.success) {
          results.briefings_delivered++
        } else {
          results.errors.push(`Slack delivery failed for ${partner.partner_id}: ${delivered.error || 'unknown'}`)
        }

        // Deliver nudges via Slack DM
        const partnerNudges = nudgesByPartner.get(partner.partner_id)
        if (partnerNudges && partnerNudges.length > 0) {
          try {
            const nudgesSent = await deliverNudges(partner.partner_id, partner.organization_id, partnerNudges)
            results.nudges_sent += nudgesSent
          } catch (nudgeError: unknown) {
            const nErr = nudgeError as { message?: string }
            results.errors.push(`Nudge delivery ${partner.partner_id}: ${nErr.message || 'Unknown error'}`)
          }
        }

        results.partners_processed++
      } catch (partnerError: unknown) {
        const err = partnerError as { message?: string }
        results.errors.push(`Partner ${partner.partner_id}: ${err.message || 'Unknown error'}`)
      }
    }

    // Step 4: Generate pre-meeting preps in parallel (each may call Sonnet)
    const prepResults = await Promise.allSettled(
      partners.map(partner =>
        sendPreMeetingPreps(partner.partner_id, partner.organization_id)
          .then(count => ({ partnerId: partner.partner_id, count }))
      )
    )

    for (const result of prepResults) {
      if (result.status === 'fulfilled') {
        results.prep_briefs_sent += result.value.count
      } else {
        results.errors.push(`Pre-meeting prep: ${result.reason?.message || 'Unknown error'}`)
      }
    }

    // Step 5: L10 prep (once per org, once per week)
    const l10ProcessedOrgs = new Set<string>()
    for (const partner of partners) {
      if (l10ProcessedOrgs.has(partner.organization_id)) continue
      l10ProcessedOrgs.add(partner.organization_id)

      try {
        const l10Date = await detectUpcomingL10(partner.organization_id, 3)
        if (l10Date && !(await hasL10PrepBeenGenerated(partner.organization_id))) {
          const { prep } = await generateL10Prep(partner.organization_id)
          results.l10_prep_generated = true

          // Deliver L10 prep to Slack
          await deliverL10Prep(partner.organization_id, prep, l10Date, partners)
        }
      } catch (l10Error: unknown) {
        const lErr = l10Error as { message?: string }
        results.errors.push(`L10 prep: ${lErr.message || 'Unknown error'}`)
      }
    }

    // Log run to agent_runs
    const durationMs = Date.now() - startTime
    await supabaseAdmin.from('agent_runs').insert({
      organization_id: partners[0]?.organization_id,
      agent_id: 'ea',
      trigger_type: 'schedule',
      trigger_context: { cron: 'morning-briefing', results },
      completed_at: new Date().toISOString(),
      duration_ms: durationMs,
      status: results.errors.length === 0 ? 'completed' : 'failed',
      outputs_created: results.briefings_generated,
      errors: results.errors.map(e => ({ message: e })),
    })

    console.log(`Morning briefing complete (${durationMs}ms):`, results)

    // Alert on errors
    if (results.errors.length > 0) {
      await postSystemAlert(
        partners[0].organization_id,
        'Morning Briefing Errors',
        results.errors.map(e => `• ${e}`).join('\n'),
        results.briefings_delivered === 0 ? 'error' : 'warning'
      )
    }

    return NextResponse.json({
      message: 'Morning briefing complete',
      duration_ms: durationMs,
      ...results,
    })
  } catch (error) {
    console.error('Morning briefing cron error:', error)

    // Try to alert on catastrophic failure
    try {
      const { data: fallbackOrg } = await supabaseAdmin
        .from('partner_preferences')
        .select('organization_id')
        .limit(1)
        .single()
      if (fallbackOrg) {
        const err = error as { message?: string }
        await postSystemAlert(
          fallbackOrg.organization_id,
          'Morning Briefing Pipeline Failed',
          `Catastrophic error: ${err.message || 'Unknown error'}`,
          'error'
        )
      }
    } catch { /* ignore alert failure */ }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Deliver nudges to a partner via Slack DM.
 * Returns the number of nudges sent.
 */
async function deliverNudges(partnerId: string, organizationId: string, nudges: Nudge[]): Promise<number> {
  const client = await getSlackClient(organizationId)
  if (!client) return 0

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('slack_user_id')
    .eq('id', partnerId)
    .single()

  if (!profile?.slack_user_id) return 0

  const dmChannel = await openDM(client, profile.slack_user_id)
  if (!dmChannel) return 0

  let sent = 0
  for (const nudge of nudges) {
    const { text, blocks } = formatNudgeForSlack(nudge)
    await postBlockMessage(client, dmChannel, text, blocks)
    sent++
  }

  return sent
}

/**
 * Check for external meetings in the next 4 hours and send pre-call intelligence briefs.
 * Returns the number of prep briefs sent.
 */
async function sendPreMeetingPreps(partnerId: string, organizationId: string): Promise<number> {
  const now = new Date()
  const fourHoursOut = new Date(now.getTime() + 4 * 60 * 60 * 1000)

  // Get calendar events in the next 4 hours that are external/client meetings
  const { data: events } = await supabaseAdmin
    .from('ingested_data')
    .select('payload, source_timestamp')
    .eq('organization_id', organizationId)
    .eq('source', 'calendar')
    .eq('data_type', 'calendar_event')
    .gte('source_timestamp', now.toISOString())
    .lte('source_timestamp', fourHoursOut.toISOString())
    .order('source_timestamp', { ascending: true })
    .limit(5)

  if (!events || events.length === 0) return 0

  // Filter to external meetings only
  const externalEvents = events.filter(e => {
    const payload = e.payload as Record<string, unknown>
    const eventType = payload.event_type as string
    return eventType === 'client_meeting' || eventType === 'external'
  })

  if (externalEvents.length === 0) return 0

  // Get Slack client and partner's Slack user ID
  const client = await getSlackClient(organizationId)
  if (!client) return 0

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('slack_user_id')
    .eq('id', partnerId)
    .single()

  if (!profile?.slack_user_id) return 0

  const dmChannel = await openDM(client, profile.slack_user_id)
  if (!dmChannel) return 0

  let sent = 0
  for (const event of externalEvents) {
    const payload = event.payload as Record<string, unknown>
    const calendarEvent = {
      title: (payload.title as string) || 'Untitled',
      start: (payload.start as string) || '',
      attendees: (payload.attendees as string[]) || [],
      event_type: (payload.event_type as string) || 'client_meeting',
      location: (payload.location as string) || undefined,
      conference_link: (payload.conference_link as string) || undefined,
    }

    const brief = await generatePreCallBrief(calendarEvent, organizationId)
    if (!brief) continue

    // Format as Slack blocks
    const blocks: Record<string, unknown>[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `📋 Pre-Call Brief: ${brief.meetingTitle}`, emoji: true },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `*Time:* ${slackDate(brief.meetingTime, '{time}')} | *Attendees:* ${esc(brief.attendees.join(', '))}` },
        ],
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: truncateForSlack(esc(brief.brief)) },
      },
    ]

    await postBlockMessage(client, dmChannel, `Pre-call brief: ${brief.meetingTitle}`, blocks)
    sent++
  }

  return sent
}

/**
 * Deliver L10 prep to Slack — post to channel and DM each partner with personalized notes.
 */
async function deliverL10Prep(
  organizationId: string,
  prep: L10Prep,
  l10Date: string,
  partners: Array<{ partner_id: string; organization_id: string }>
): Promise<void> {
  const client = await getSlackClient(organizationId)
  if (!client) return

  // Static format for plain_text headers, dynamic for mrkdwn contexts
  const l10DateStatic = new Date(l10Date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
  const l10DateToken = slackDate(l10Date, '{date_long}')

  // Build the main prep blocks
  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `L10 Meeting Prep — ${l10DateStatic}`, emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*${esc(prep.headline)}*` },
    },
    { type: 'divider' },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Scorecard*\n${esc(prep.scorecard_review.summary)}` },
        { type: 'mrkdwn', text: `*Rocks*\n${esc(prep.rock_review.summary)}` },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*To-Dos:* ${prep.todo_review.completion_rate_2wk}% completion rate | ${prep.todo_review.overdue_count} overdue\n${esc(prep.todo_review.note)}`,
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Financial*\n${esc(prep.financial_snapshot)}` },
        { type: 'mrkdwn', text: `*Pipeline*\n${esc(prep.pipeline_snapshot)}` },
      ],
    },
  ]

  // IDS priorities
  if (prep.issues_list.length > 0) {
    blocks.push({ type: 'divider' })
    const issueLines = prep.issues_list
      .sort((a, b) => a.recommended_order - b.recommended_order)
      .map((issue, i) => `${i + 1}. ${esc(issue.title)} _(${esc(issue.priority)}, ${issue.age_days}d old)_`)
    const issueChunks = chunkForSlackSections(issueLines, '\n')
    issueChunks.forEach((chunk, i) => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: i === 0 ? `*IDS Priority Order:*\n${chunk}` : chunk,
        },
      })
    })
  }

  // Ember observations
  if (prep.ember_observations.length > 0) {
    blocks.push({ type: 'divider' })
    const obsLines = prep.ember_observations.map(o => `• ${esc(o)}`)
    const obsChunks = chunkForSlackSections(obsLines, '\n')
    obsChunks.forEach((chunk, i) => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: i === 0 ? `*Ember Observations:*\n${chunk}` : chunk,
        },
      })
    })
  }

  // Post to the first partner's configured channel (or find org-level channel)
  const { data: slackSettings } = await supabaseAdmin
    .from('slack_settings')
    .select('default_channel_id')
    .eq('organization_id', organizationId)
    .single()

  if (slackSettings?.default_channel_id) {
    await postBlockMessage(
      client,
      slackSettings.default_channel_id,
      `L10 Meeting Prep — ${l10DateToken}: ${prep.headline}`,
      blocks
    )
  }

  // Also DM each partner with their personalized Rock/To-do summary
  const orgPartners = partners.filter(p => p.organization_id === organizationId)
  for (const partner of orgPartners) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('slack_user_id, full_name')
      .eq('id', partner.partner_id)
      .single()

    if (!profile?.slack_user_id) continue

    const dmChannel = await openDM(client, profile.slack_user_id)
    if (!dmChannel) continue

    // Find this partner's rocks and todos
    const partnerName = profile.full_name || 'Unknown'
    const myRocks = prep.rock_review.rocks.filter(r => r.owner === partnerName)
    const myOverdue = prep.todo_review.carryforward_items

    const personalBlocks: Record<string, unknown>[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Your L10 Prep — ${l10DateToken}*\n\nThe full prep has been posted to the team channel. Here's your personal summary:`,
        },
      },
    ]

    if (myRocks.length > 0) {
      personalBlocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Your Rocks:*\n' + myRocks.map(r =>
            `• ${esc(r.title)} — ${esc(r.status)} (${r.completion_pct}% done) ${esc(r.note)}`
          ).join('\n'),
        },
      })
    }

    if (myOverdue.length > 0) {
      personalBlocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Carried-Forward To-Dos:*\n' + myOverdue.map(t => `• ${esc(t)}`).join('\n'),
        },
      })
    }

    await postBlockMessage(client, dmChannel, `Your L10 Prep — ${l10DateToken}`, personalBlocks)
  }
}
