import { NextRequest, NextResponse } from 'next/server'
import { hubspotConnector } from '@/lib/connectors/hubspot-connector'
import { verifyCronAuth, loadPartners, persistRecords } from '@/lib/agents/ingest-helpers'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    if (!process.env.HUBSPOT_ACCESS_TOKEN) {
      return NextResponse.json({ message: 'HubSpot not configured', records: 0 })
    }

    const { data: partners, error: fetchError } = await loadPartners()
    if (fetchError || !partners) {
      return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 })
    }

    const results = { records: 0, errors: [] as string[] }
    const processedOrgs = new Set<string>()

    for (const partner of partners) {
      if (processedOrgs.has(partner.organization_id)) continue
      processedOrgs.add(partner.organization_id)

      try {
        const hubspotResult = await hubspotConnector.pull({
          organizationId: partner.organization_id,
          partnerId: partner.partner_id,
          config: {},
        })

        if (hubspotResult.records.length > 0) {
          const err = await persistRecords(hubspotResult.records, partner.organization_id)
          if (err) results.errors.push(`Persist(${partner.organization_id}): ${err}`)
        }
        results.records += hubspotResult.records.length

        if (hubspotResult.errors.length > 0) {
          results.errors.push(...hubspotResult.errors.map(e => `HubSpot(${partner.organization_id}): ${e.message}`))
        }
      } catch (err: unknown) {
        results.errors.push(`HubSpot(${partner.organization_id}): ${(err as Error).message || 'Connector crashed'}`)
      }
    }

    console.log('HubSpot ingestion complete:', results)
    return NextResponse.json({ message: 'HubSpot ingestion complete', ...results })
  } catch (error) {
    console.error('HubSpot ingestion cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
