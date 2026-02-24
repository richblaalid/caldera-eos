import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { gmailConnector } from '@/lib/connectors/gmail-connector'
import { calendarConnector } from '@/lib/connectors/calendar-connector'
import { hubspotConnector } from '@/lib/connectors/hubspot-connector'
import { transcriptConnector } from '@/lib/connectors/transcript-connector'
import type { ConnectorRecord } from '@/lib/connectors/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/agents/cron/data-ingestion
// Runs every 15 minutes to pull Gmail and Calendar data for all partners with Google tokens.
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Get all partners with any connector tokens
    const { data: partners, error: fetchError } = await supabaseAdmin
      .from('partner_preferences')
      .select('partner_id, organization_id, google_refresh_token, google_history_id, grain_last_sync')

    if (fetchError) {
      console.error('Failed to fetch partner preferences:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 })
    }

    if (!partners || partners.length === 0) {
      return NextResponse.json({ message: 'No partners configured', ingested: 0 })
    }

    const results = {
      partners_processed: 0,
      gmail_records: 0,
      calendar_records: 0,
      hubspot_records: 0,
      transcript_records: 0,
      errors: [] as string[],
    }

    // Track which orgs have already run org-level connectors (avoid duplicate runs)
    const hubspotProcessedOrgs = new Set<string>()
    const transcriptProcessedOrgs = new Set<string>()

    for (const partner of partners) {
      const config = {
        google_refresh_token: partner.google_refresh_token,
        google_history_id: partner.google_history_id,
      }

      // Run Gmail connector (graceful — failure doesn't block other connectors)
      let gmailRecords: ConnectorRecord[] = []
      if (partner.google_refresh_token) {
        try {
          const gmailResult = await gmailConnector.pull({
            organizationId: partner.organization_id,
            partnerId: partner.partner_id,
            config,
          })

          gmailRecords = gmailResult.records
          if (gmailResult.errors.length > 0) {
            results.errors.push(...gmailResult.errors.map(e => `Gmail(${partner.partner_id}): ${e.message}`))
          }

          // Update historyId if we got a new one
          if (gmailResult.syncState?.google_history_id) {
            await supabaseAdmin
              .from('partner_preferences')
              .update({ google_history_id: gmailResult.syncState.google_history_id as string })
              .eq('partner_id', partner.partner_id)
              .eq('organization_id', partner.organization_id)
          }
        } catch (gmailError: unknown) {
          const err = gmailError as { message?: string }
          results.errors.push(`Gmail(${partner.partner_id}): ${err.message || 'Connector crashed'}`)
        }
      }

      // Run Calendar connector
      let calendarRecords: ConnectorRecord[] = []
      if (partner.google_refresh_token) {
        try {
          const calendarResult = await calendarConnector.pull({
            organizationId: partner.organization_id,
            partnerId: partner.partner_id,
            config,
          })

          calendarRecords = calendarResult.records
          if (calendarResult.errors.length > 0) {
            results.errors.push(...calendarResult.errors.map(e => `Calendar(${partner.partner_id}): ${e.message}`))
          }
        } catch (calError: unknown) {
          const err = calError as { message?: string }
          results.errors.push(`Calendar(${partner.partner_id}): ${err.message || 'Connector crashed'}`)
        }
      }

      // Run HubSpot connector (once per org — uses env-based token, not per-partner)
      let hubspotRecords: ConnectorRecord[] = []
      if (process.env.HUBSPOT_ACCESS_TOKEN && !hubspotProcessedOrgs.has(partner.organization_id)) {
        hubspotProcessedOrgs.add(partner.organization_id)
        try {
          const hubspotResult = await hubspotConnector.pull({
            organizationId: partner.organization_id,
            partnerId: partner.partner_id,
            config: {},
          })

          hubspotRecords = hubspotResult.records
          if (hubspotResult.errors.length > 0) {
            results.errors.push(...hubspotResult.errors.map(e => `HubSpot(${partner.organization_id}): ${e.message}`))
          }
        } catch (hsError: unknown) {
          const err = hsError as { message?: string }
          results.errors.push(`HubSpot(${partner.organization_id}): ${err.message || 'Connector crashed'}`)
        }
      }

      // Run Transcript connector (once per org — reads from transcripts table)
      let transcriptRecords: ConnectorRecord[] = []
      if (!transcriptProcessedOrgs.has(partner.organization_id)) {
        transcriptProcessedOrgs.add(partner.organization_id)
        try {
          const transcriptResult = await transcriptConnector.pull({
            organizationId: partner.organization_id,
            partnerId: partner.partner_id,
            config: { grain_last_sync: partner.grain_last_sync },
          })

          transcriptRecords = transcriptResult.records
          if (transcriptResult.errors.length > 0) {
            results.errors.push(...transcriptResult.errors.map(e => `Transcript(${partner.organization_id}): ${e.message}`))
          }

          // Update grain_last_sync if we got a new timestamp
          if (transcriptResult.syncState?.grain_last_sync) {
            await supabaseAdmin
              .from('partner_preferences')
              .update({ grain_last_sync: transcriptResult.syncState.grain_last_sync as string })
              .eq('partner_id', partner.partner_id)
              .eq('organization_id', partner.organization_id)
          }
        } catch (trError: unknown) {
          const err = trError as { message?: string }
          results.errors.push(`Transcript(${partner.organization_id}): ${err.message || 'Connector crashed'}`)
        }
      }

      // Persist all records to ingested_data
      const allRecords = [...gmailRecords, ...calendarRecords, ...hubspotRecords, ...transcriptRecords]
      if (allRecords.length > 0) {
        const insertError = await persistRecords(allRecords, partner.organization_id)
        if (insertError) {
          results.errors.push(`Persist(${partner.partner_id}): ${insertError}`)
        }
      }

      results.gmail_records += gmailRecords.length
      results.calendar_records += calendarRecords.length
      results.hubspot_records += hubspotRecords.length
      results.transcript_records += transcriptRecords.length
      results.partners_processed++
    }

    console.log('Data ingestion complete:', results)

    return NextResponse.json({
      message: 'Data ingestion complete',
      ...results,
    })
  } catch (error) {
    console.error('Data ingestion cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Upsert connector records into the ingested_data table.
 * Uses ON CONFLICT to avoid duplicates (org_id + source + source_id).
 */
async function persistRecords(records: ConnectorRecord[], organizationId: string): Promise<string | null> {
  const rows = records.map(r => ({
    organization_id: organizationId,
    source: r.source,
    source_id: r.sourceId,
    data_type: r.dataType,
    payload: r.payload,
    raw_payload: r.rawPayload || null,
    entities: r.entities,
    relevance_tags: r.relevanceTags,
    source_timestamp: r.sourceTimestamp,
  }))

  const { error } = await supabaseAdmin
    .from('ingested_data')
    .upsert(rows, { onConflict: 'organization_id,source,source_id' })

  if (error) {
    console.error('Failed to persist records:', error)
    return error.message
  }

  return null
}
