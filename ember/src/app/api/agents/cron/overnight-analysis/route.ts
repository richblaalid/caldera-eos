import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { quickbooksConnector } from '@/lib/connectors/quickbooks-connector'
import { runFinancialAnalysis } from '@/lib/agents/financial-strategist'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/agents/cron/overnight-analysis
// Runs daily at 4:00 AM ET to ingest QuickBooks data and run Financial Strategist analysis.
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Get all partners with QuickBooks tokens
    const { data: partners, error: fetchError } = await supabaseAdmin
      .from('partner_preferences')
      .select('partner_id, organization_id, quickbooks_refresh_token, quickbooks_realm_id')

    if (fetchError) {
      console.error('Failed to fetch partner preferences:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 })
    }

    const results = {
      qb_ingestion: { partners_processed: 0, records_ingested: 0, errors: [] as string[] },
      financial_analysis: { orgs_processed: 0, outputs_created: 0, issues_created: 0, errors: [] as string[] },
    }

    // Step 1: QuickBooks data ingestion per partner
    const orgsWithData = new Set<string>()

    for (const partner of (partners || [])) {
      if (!partner.quickbooks_refresh_token || !partner.quickbooks_realm_id) continue

      try {
        const result = await quickbooksConnector.pull({
          organizationId: partner.organization_id,
          partnerId: partner.partner_id,
          config: {
            quickbooks_refresh_token: partner.quickbooks_refresh_token,
            quickbooks_realm_id: partner.quickbooks_realm_id,
          },
        })

        // Persist records
        for (const record of result.records) {
          await supabaseAdmin.from('ingested_data').upsert({
            organization_id: partner.organization_id,
            source: record.source,
            source_id: record.sourceId,
            data_type: record.dataType,
            payload: record.payload,
            raw_payload: record.rawPayload,
            entities: record.entities,
            relevance_tags: record.relevanceTags,
            source_timestamp: record.sourceTimestamp,
          }, {
            onConflict: 'organization_id,source,source_id',
          })
        }

        // Update refresh token if rotated
        if (result.syncState?.quickbooks_refresh_token) {
          await supabaseAdmin
            .from('partner_preferences')
            .update({ quickbooks_refresh_token: result.syncState.quickbooks_refresh_token as string })
            .eq('partner_id', partner.partner_id)
        }

        results.qb_ingestion.records_ingested += result.records.length
        results.qb_ingestion.partners_processed++
        orgsWithData.add(partner.organization_id)

        for (const error of result.errors) {
          results.qb_ingestion.errors.push(`${partner.partner_id}: ${error.message}`)
        }
      } catch (error: unknown) {
        const err = error as { message?: string }
        results.qb_ingestion.errors.push(`Partner ${partner.partner_id}: ${err.message || 'Unknown error'}`)
      }
    }

    // Step 2: Run Financial Strategist analysis per organization
    // Run for all orgs that have partners (even without QBO data — it will use scorecard data)
    const allOrgs = new Set((partners || []).map(p => p.organization_id))

    for (const orgId of allOrgs) {
      try {
        const result = await runFinancialAnalysis(orgId)
        results.financial_analysis.outputs_created += result.outputsCreated
        results.financial_analysis.issues_created += result.issuesCreated
        results.financial_analysis.orgs_processed++
      } catch (error: unknown) {
        const err = error as { message?: string }
        results.financial_analysis.errors.push(`Org ${orgId}: ${err.message || 'Unknown error'}`)
      }
    }

    const durationMs = Date.now() - startTime

    // Log run to agent_runs
    const firstOrgId = partners?.[0]?.organization_id
    if (firstOrgId) {
      await supabaseAdmin.from('agent_runs').insert({
        organization_id: firstOrgId,
        agent_id: 'financial-strategist',
        trigger_type: 'schedule',
        trigger_context: { cron: 'overnight-analysis', results },
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        status: results.financial_analysis.errors.length === 0 ? 'completed' : 'completed',
        outputs_created: results.financial_analysis.outputs_created,
        errors: [
          ...results.qb_ingestion.errors.map(e => ({ message: e })),
          ...results.financial_analysis.errors.map(e => ({ message: e })),
        ],
      })
    }

    console.log('Overnight analysis complete:', results)

    return NextResponse.json({
      message: 'Overnight analysis complete',
      duration_ms: durationMs,
      ...results,
    })
  } catch (error) {
    console.error('Overnight analysis cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
