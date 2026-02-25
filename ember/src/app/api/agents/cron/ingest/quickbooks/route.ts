import { NextRequest, NextResponse } from 'next/server'
import { quickbooksConnector } from '@/lib/connectors/quickbooks-connector'
import { verifyCronAuth, loadPartners, persistRecords, supabaseAdmin } from '@/lib/agents/ingest-helpers'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const { data: partners, error: fetchError } = await loadPartners()
    if (fetchError || !partners) {
      return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 })
    }

    const results = { records: 0, errors: [] as string[] }
    const processedOrgs = new Set<string>()

    for (const partner of partners) {
      if (!partner.quickbooks_refresh_token || !partner.quickbooks_realm_id) continue
      if (processedOrgs.has(partner.organization_id)) continue
      processedOrgs.add(partner.organization_id)

      try {
        const qboResult = await quickbooksConnector.pull({
          organizationId: partner.organization_id,
          partnerId: partner.partner_id,
          config: {
            quickbooks_refresh_token: partner.quickbooks_refresh_token,
            quickbooks_realm_id: partner.quickbooks_realm_id,
          },
        })

        if (qboResult.records.length > 0) {
          const err = await persistRecords(qboResult.records, partner.organization_id)
          if (err) results.errors.push(`Persist(${partner.organization_id}): ${err}`)
        }
        results.records += qboResult.records.length

        if (qboResult.errors.length > 0) {
          results.errors.push(...qboResult.errors.map(e => `QBO(${partner.organization_id}): ${e.message}`))
        }

        // Save rotated refresh token
        if (qboResult.syncState?.quickbooks_refresh_token) {
          await supabaseAdmin
            .from('partner_preferences')
            .update({ quickbooks_refresh_token: qboResult.syncState.quickbooks_refresh_token as string })
            .eq('partner_id', partner.partner_id)
            .eq('organization_id', partner.organization_id)
        }
      } catch (err: unknown) {
        results.errors.push(`QBO(${partner.organization_id}): ${(err as Error).message || 'Connector crashed'}`)
      }
    }

    console.log('QuickBooks ingestion complete:', results)
    return NextResponse.json({ message: 'QuickBooks ingestion complete', ...results })
  } catch (error) {
    console.error('QuickBooks ingestion cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
