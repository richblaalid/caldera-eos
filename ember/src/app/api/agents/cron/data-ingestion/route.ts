import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { gmailConnector } from '@/lib/connectors/gmail-connector'
import { calendarConnector } from '@/lib/connectors/calendar-connector'
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

    // Get all partners with Google refresh tokens
    const { data: partners, error: fetchError } = await supabaseAdmin
      .from('partner_preferences')
      .select('partner_id, organization_id, google_refresh_token, google_history_id')
      .not('google_refresh_token', 'is', null)

    if (fetchError) {
      console.error('Failed to fetch partner preferences:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 })
    }

    if (!partners || partners.length === 0) {
      return NextResponse.json({ message: 'No partners with Google tokens configured', ingested: 0 })
    }

    const results = {
      partners_processed: 0,
      gmail_records: 0,
      calendar_records: 0,
      errors: [] as string[],
    }

    for (const partner of partners) {
      const config = {
        google_refresh_token: partner.google_refresh_token,
        google_history_id: partner.google_history_id,
      }

      // Run Gmail connector
      const gmailResult = await gmailConnector.pull({
        organizationId: partner.organization_id,
        partnerId: partner.partner_id,
        config,
      })

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

      // Run Calendar connector
      const calendarResult = await calendarConnector.pull({
        organizationId: partner.organization_id,
        partnerId: partner.partner_id,
        config,
      })

      if (calendarResult.errors.length > 0) {
        results.errors.push(...calendarResult.errors.map(e => `Calendar(${partner.partner_id}): ${e.message}`))
      }

      // Persist all records to ingested_data
      const allRecords = [...gmailResult.records, ...calendarResult.records]
      if (allRecords.length > 0) {
        const insertError = await persistRecords(allRecords, partner.organization_id)
        if (insertError) {
          results.errors.push(`Persist(${partner.partner_id}): ${insertError}`)
        }
      }

      results.gmail_records += gmailResult.records.length
      results.calendar_records += calendarResult.records.length
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
