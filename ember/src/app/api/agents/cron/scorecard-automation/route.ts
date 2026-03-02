import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computeWeeklyScorecard, getCurrentWeekStart } from '@/lib/agents/scorecard-automation'
import { postSystemAlert, getSlackClient, openDM, postBlockMessage } from '@/lib/connectors/slack-connector'
import { escapeSlackMrkdwn } from '@/lib/slack-format'
import { verifyCronAuth } from '@/lib/agents/ingest-helpers'

const esc = escapeSlackMrkdwn

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/agents/cron/scorecard-automation
// Runs weekly (Sunday 5 AM ET) to compute automated scorecard metrics
// and prompt owners for manual ones.
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify cron secret
    const authError = verifyCronAuth(request)
    if (authError) return authError

    // Get all organizations
    const { data: orgs, error: fetchError } = await supabaseAdmin
      .from('partner_preferences')
      .select('organization_id')

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 })
    }

    const orgIds = [...new Set((orgs || []).map(o => o.organization_id))]
    const weekOf = getCurrentWeekStart()

    const results = {
      week_of: weekOf,
      orgs_processed: 0,
      metrics_computed: 0,
      metrics_manual_prompted: 0,
      errors: [] as string[],
    }

    for (const orgId of orgIds) {
      try {
        const scorecardResult = await computeWeeklyScorecard(orgId)

        results.metrics_computed += scorecardResult.metricsComputed
        results.errors.push(...scorecardResult.errors)

        // Prompt owners for manual metrics via Slack
        if (scorecardResult.manualMetrics.length > 0) {
          const prompted = await promptForManualMetrics(
            orgId,
            weekOf,
            scorecardResult.manualMetrics
          )
          results.metrics_manual_prompted += prompted
        }

        results.orgs_processed++
      } catch (error: unknown) {
        const err = error as { message?: string }
        results.errors.push(`Org ${orgId}: ${err.message || 'Unknown error'}`)
      }
    }

    // Log to agent_runs
    const durationMs = Date.now() - startTime
    if (orgIds.length > 0) {
      await supabaseAdmin.from('agent_runs').insert({
        organization_id: orgIds[0],
        agent_id: 'scorecard-automation',
        trigger_type: 'schedule',
        trigger_context: { cron: 'scorecard-automation', results },
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        status: 'completed',
        outputs_created: results.metrics_computed,
        errors: results.errors.map(e => ({ message: e })),
      })
    }

    // Alert on errors
    if (results.errors.length > 0 && orgIds.length > 0) {
      await postSystemAlert(
        orgIds[0],
        'Scorecard Automation Errors',
        results.errors.map(e => `• ${e}`).join('\n'),
        'warning'
      )
    }

    console.log('Scorecard automation complete:', results)

    return NextResponse.json({
      message: 'Scorecard automation complete',
      ...results,
    })
  } catch (error) {
    console.error('Scorecard automation cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DM each metric owner via Slack asking for their manual metric values.
 * Returns the number of owners prompted.
 */
async function promptForManualMetrics(
  orgId: string,
  weekOf: string,
  manualMetrics: Array<{ metricName: string; ownerId: string | null }>
): Promise<number> {
  const client = await getSlackClient(orgId)
  if (!client) return 0

  // Group metrics by owner
  const byOwner = new Map<string, string[]>()
  for (const m of manualMetrics) {
    if (!m.ownerId) continue
    const existing = byOwner.get(m.ownerId) || []
    existing.push(m.metricName)
    byOwner.set(m.ownerId, existing)
  }

  let prompted = 0

  for (const [ownerId, metricNames] of byOwner) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('slack_user_id, name')
      .eq('id', ownerId)
      .single()

    if (!profile?.slack_user_id) continue

    const dmChannel = await openDM(client, profile.slack_user_id)
    if (!dmChannel) continue

    const firstName = (profile.name || 'there').split(' ')[0]
    const weekLabel = new Date(weekOf + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
    })

    const metricList = metricNames.map(name =>
      `• *${esc(name)}* — reply: \`${name}: <value>\``
    ).join('\n')

    const blocks: Record<string, unknown>[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `Scorecard — Week of ${weekLabel}`, emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Hey ${firstName}, I need your weekly numbers:\n\n${metricList}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Reply here with your values, or <https://app.withcaldera.com/dashboard/scorecard/entry|enter in dashboard>.',
          },
        ],
      },
    ]

    await postBlockMessage(
      client,
      dmChannel,
      `Scorecard data needed for week of ${weekLabel}`,
      blocks
    )
    prompted++
  }

  return prompted
}
