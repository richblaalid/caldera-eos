import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ConnectorRecord } from '@/lib/connectors/types'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Verify cron secret. Returns error response if unauthorized, null if OK. */
export function verifyCronAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('CRON_SECRET not configured — rejecting request')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

/** Load partner preferences with the columns needed for ingestion. */
export async function loadPartners() {
  return supabaseAdmin
    .from('partner_preferences')
    .select('partner_id, organization_id, google_refresh_token, google_history_id, quickbooks_refresh_token, quickbooks_realm_id, grain_refresh_token, grain_client_id, config')
}

/** Upsert connector records into ingested_data. */
export async function persistRecords(records: ConnectorRecord[], organizationId: string): Promise<string | null> {
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
