import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateBriefing, saveBriefing } from '@/lib/agents/ea-briefing'
import { deliverBriefing } from '@/lib/agents/slack-briefing'
import { postSystemAlert, getSlackClient, openDM, postBlockMessage } from '@/lib/connectors/slack-connector'
import { generatePreCallBrief } from '@/lib/agents/meeting-prep'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/agents/cron/morning-briefing
// Runs weekday mornings to generate and deliver briefings to each partner.
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

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
      errors: [] as string[],
    }

    for (const partner of partners) {
      try {
        // Generate briefing
        const briefing = await generateBriefing(partner.partner_id, partner.organization_id)

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
          briefing
        )

        if (delivered.success) {
          results.briefings_delivered++
        } else {
          results.errors.push(`Slack delivery failed for ${partner.partner_id}: ${delivered.error || 'unknown'}`)
        }

        // Generate pre-meeting prep for external meetings in next 4 hours
        try {
          const prepsSent = await sendPreMeetingPreps(partner.partner_id, partner.organization_id)
          results.prep_briefs_sent += prepsSent
        } catch (prepError: unknown) {
          const pErr = prepError as { message?: string }
          results.errors.push(`Pre-meeting prep ${partner.partner_id}: ${pErr.message || 'Unknown error'}`)
        }

        results.partners_processed++
      } catch (partnerError: unknown) {
        const err = partnerError as { message?: string }
        results.errors.push(`Partner ${partner.partner_id}: ${err.message || 'Unknown error'}`)
      }
    }

    // Log run to agent_runs
    await supabaseAdmin.from('agent_runs').insert({
      organization_id: partners[0]?.organization_id,
      agent_id: 'ea',
      trigger_type: 'schedule',
      trigger_context: { cron: 'morning-briefing', results },
      completed_at: new Date().toISOString(),
      duration_ms: 0, // Could track this more precisely
      status: results.errors.length === 0 ? 'completed' : 'completed',
      outputs_created: results.briefings_generated,
      errors: results.errors.map(e => ({ message: e })),
    })

    console.log('Morning briefing complete:', results)

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
          { type: 'mrkdwn', text: `*Time:* ${new Date(brief.meetingTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} | *Attendees:* ${brief.attendees.join(', ')}` },
        ],
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: brief.brief },
      },
    ]

    await postBlockMessage(client, dmChannel, `Pre-call brief: ${brief.meetingTitle}`, blocks)
    sent++
  }

  return sent
}
