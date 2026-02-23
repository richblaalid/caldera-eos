import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateBriefing, saveBriefing } from '@/lib/agents/ea-briefing'
import { deliverBriefing } from '@/lib/agents/slack-briefing'
import { runFinancialAnalysis } from '@/lib/agents/financial-strategist'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/agents/test/pipeline
 * Manual test endpoint to run the full agent pipeline end-to-end.
 * Requires CRON_SECRET or dev mode.
 *
 * Query params:
 *   ?step=all|financial|briefing|deliver  (default: all)
 *   ?partner_id=<uuid>  (optional, defaults to first partner with preferences)
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { searchParams } = new URL(request.url)
    const step = searchParams.get('step') || 'all'
    const partnerIdParam = searchParams.get('partner_id')

    // Get partner info
    const partnerQuery = supabaseAdmin
      .from('partner_preferences')
      .select('partner_id, organization_id')

    if (partnerIdParam) {
      partnerQuery.eq('partner_id', partnerIdParam)
    }

    const { data: partners } = await partnerQuery.limit(1).single()

    if (!partners) {
      return NextResponse.json({
        error: 'No partner preferences found. Create partner_preferences first.',
      }, { status: 404 })
    }

    const { partner_id: partnerId, organization_id: organizationId } = partners
    const results: Record<string, unknown> = { partner_id: partnerId, organization_id: organizationId }

    // Step 1: Financial Strategist analysis
    if (step === 'all' || step === 'financial') {
      try {
        const financialResult = await runFinancialAnalysis(organizationId)
        results.financial = {
          status: 'success',
          summary: financialResult.analysis.summary,
          outputs_created: financialResult.outputsCreated,
          issues_created: financialResult.issuesCreated,
          ar_alerts: financialResult.analysis.ar_aging_alerts.length,
          margin_clients: financialResult.analysis.margin_analysis.length,
        }
      } catch (error: unknown) {
        const err = error as { message?: string }
        results.financial = { status: 'error', message: err.message }
      }
    }

    // Step 2: Generate briefing
    if (step === 'all' || step === 'briefing' || step === 'deliver') {
      try {
        const briefing = await generateBriefing(partnerId, organizationId)
        const briefingId = await saveBriefing(briefing)

        results.briefing = {
          status: 'success',
          briefing_id: briefingId,
          tier1_count: briefing.tier1_urgent?.length || 0,
          tier2_count: briefing.tier2_business?.length || 0,
          tier3_count: briefing.tier3_industry?.length || 0,
          work_queue_count: briefing.agent_work_queue?.length || 0,
          tier1_items: briefing.tier1_urgent?.map(i => i.title),
          tier2_items: briefing.tier2_business?.map(i => i.title),
        }

        // Step 3: Deliver via Slack
        if ((step === 'all' || step === 'deliver') && briefingId) {
          try {
            const delivered = await deliverBriefing(partnerId, organizationId, briefingId, briefing)
            results.delivery = {
              status: delivered ? 'success' : 'failed',
              slack_delivered: delivered,
            }
          } catch (error: unknown) {
            const err = error as { message?: string }
            results.delivery = { status: 'error', message: err.message }
          }
        }
      } catch (error: unknown) {
        const err = error as { message?: string }
        results.briefing = { status: 'error', message: err.message }
      }
    }

    // Verification: check database state
    const [agentRuns, agentOutputs, briefings] = await Promise.all([
      supabaseAdmin
        .from('agent_runs')
        .select('id, agent_id, status, completed_at')
        .eq('organization_id', organizationId)
        .order('started_at', { ascending: false })
        .limit(3),
      supabaseAdmin
        .from('agent_outputs')
        .select('id, agent_id, output_type, status, title')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabaseAdmin
        .from('briefings')
        .select('id, briefing_date, delivered_at, slack_message_ts')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false })
        .limit(3),
    ])

    results.verification = {
      recent_agent_runs: agentRuns.data,
      recent_agent_outputs: agentOutputs.data,
      recent_briefings: briefings.data,
    }

    return NextResponse.json({
      message: `Pipeline test complete (step: ${step})`,
      ...results,
    })
  } catch (error) {
    console.error('Pipeline test error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
