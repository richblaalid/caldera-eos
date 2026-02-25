import { NextRequest, NextResponse } from 'next/server'
import { transcriptConnector } from '@/lib/connectors/transcript-connector'
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
      if (processedOrgs.has(partner.organization_id)) continue
      processedOrgs.add(partner.organization_id)

      try {
        const transcriptResult = await transcriptConnector.pull({
          organizationId: partner.organization_id,
          partnerId: partner.partner_id,
          config: { grain_last_sync: (partner.config as Record<string, unknown>)?.grain_last_sync },
        })

        if (transcriptResult.records.length > 0) {
          const err = await persistRecords(transcriptResult.records, partner.organization_id)
          if (err) results.errors.push(`Persist(${partner.organization_id}): ${err}`)
        }
        results.records += transcriptResult.records.length

        if (transcriptResult.errors.length > 0) {
          results.errors.push(...transcriptResult.errors.map(e => `Transcript(${partner.organization_id}): ${e.message}`))
        }

        // Update grain_last_sync in config JSONB
        if (transcriptResult.syncState?.grain_last_sync) {
          const updatedConfig = {
            ...((partner.config as Record<string, unknown>) || {}),
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
