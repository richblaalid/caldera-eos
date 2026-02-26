import { NextRequest, NextResponse } from 'next/server'
import { googleDriveConnector } from '@/lib/connectors/google-drive-connector'
import { verifyCronAuth, loadPartners, persistRecords } from '@/lib/agents/ingest-helpers'

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

    const results = { partners_processed: 0, documents_ingested: 0, errors: [] as string[] }

    for (const partner of partners) {
      if (!partner.google_refresh_token) continue

      try {
        const driveResult = await googleDriveConnector.pull({
          organizationId: partner.organization_id,
          partnerId: partner.partner_id,
          config: {
            google_refresh_token: partner.google_refresh_token,
            drive_folder_id: (partner.config as Record<string, unknown>)?.drive_folder_id,
          },
        })

        if (driveResult.records.length > 0) {
          const err = await persistRecords(driveResult.records, partner.organization_id)
          if (err) results.errors.push(`Persist Drive(${partner.partner_id}): ${err}`)
        }
        results.documents_ingested += driveResult.records.length

        if (driveResult.errors.length > 0) {
          results.errors.push(...driveResult.errors.map(e => `Drive(${partner.partner_id}): ${e.message}`))
        }
      } catch (err: unknown) {
        results.errors.push(`Drive(${partner.partner_id}): ${(err as Error).message || 'Connector crashed'}`)
      }

      results.partners_processed++
    }

    console.log('Google Drive ingestion complete:', results)
    return NextResponse.json({ message: 'Google Drive ingestion complete', ...results })
  } catch (error) {
    console.error('Google Drive ingestion cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
