import { NextRequest, NextResponse } from 'next/server'
import { gmailConnector } from '@/lib/connectors/gmail-connector'
import { calendarConnector } from '@/lib/connectors/calendar-connector'
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

    const results = { partners_processed: 0, gmail_records: 0, calendar_records: 0, errors: [] as string[] }

    for (const partner of partners) {
      if (!partner.google_refresh_token) continue

      const config = {
        google_refresh_token: partner.google_refresh_token,
        google_history_id: partner.google_history_id,
      }

      // Gmail
      try {
        const gmailResult = await gmailConnector.pull({
          organizationId: partner.organization_id,
          partnerId: partner.partner_id,
          config,
        })

        if (gmailResult.records.length > 0) {
          const err = await persistRecords(gmailResult.records, partner.organization_id)
          if (err) results.errors.push(`Persist Gmail(${partner.partner_id}): ${err}`)
        }
        results.gmail_records += gmailResult.records.length

        if (gmailResult.syncState?.google_history_id) {
          await supabaseAdmin
            .from('partner_preferences')
            .update({ google_history_id: gmailResult.syncState.google_history_id as string })
            .eq('partner_id', partner.partner_id)
            .eq('organization_id', partner.organization_id)
        }

        if (gmailResult.errors.length > 0) {
          results.errors.push(...gmailResult.errors.map(e => `Gmail(${partner.partner_id}): ${e.message}`))
        }
      } catch (err: unknown) {
        results.errors.push(`Gmail(${partner.partner_id}): ${(err as Error).message || 'Connector crashed'}`)
      }

      // Calendar
      try {
        const calResult = await calendarConnector.pull({
          organizationId: partner.organization_id,
          partnerId: partner.partner_id,
          config,
        })

        if (calResult.records.length > 0) {
          const err = await persistRecords(calResult.records, partner.organization_id)
          if (err) results.errors.push(`Persist Cal(${partner.partner_id}): ${err}`)
        }
        results.calendar_records += calResult.records.length

        if (calResult.errors.length > 0) {
          results.errors.push(...calResult.errors.map(e => `Calendar(${partner.partner_id}): ${e.message}`))
        }
      } catch (err: unknown) {
        results.errors.push(`Calendar(${partner.partner_id}): ${(err as Error).message || 'Connector crashed'}`)
      }

      results.partners_processed++
    }

    console.log('Google ingestion complete:', results)
    return NextResponse.json({ message: 'Google ingestion complete', ...results })
  } catch (error) {
    console.error('Google ingestion cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
