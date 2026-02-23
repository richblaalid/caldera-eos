import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/agents/status - Returns connector status for the current user's org
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const orgId = membership.organization_id
    const serviceClient = await createServiceClient()

    // Get partner preferences (tokens)
    const { data: prefs } = await serviceClient
      .from('partner_preferences')
      .select('google_refresh_token, quickbooks_refresh_token, quickbooks_realm_id, hubspot_refresh_token, hubspot_portal_id')
      .eq('organization_id', orgId)
      .eq('partner_id', user.id)
      .single()

    // Get Slack status
    const { data: slackSettings } = await serviceClient
      .from('slack_settings')
      .select('bot_token, team_name')
      .eq('organization_id', orgId)
      .single()

    // Get last sync timestamps per source
    const lastSyncBySource = await getLastSyncTimes(serviceClient, orgId)

    const connectors = [
      {
        name: 'Google (Gmail + Calendar)',
        key: 'google',
        connected: !!prefs?.google_refresh_token,
        lastSync: lastSyncBySource.gmail || lastSyncBySource.calendar || null,
      },
      {
        name: 'Slack',
        key: 'slack',
        connected: !!slackSettings?.bot_token,
        lastSync: null,
        details: slackSettings?.team_name ? `Workspace: ${slackSettings.team_name}` : undefined,
      },
      {
        name: 'HubSpot',
        key: 'hubspot',
        connected: !!prefs?.hubspot_refresh_token,
        lastSync: lastSyncBySource.hubspot || null,
        details: prefs?.hubspot_portal_id ? `Portal: ${prefs.hubspot_portal_id}` : undefined,
      },
      {
        name: 'QuickBooks',
        key: 'quickbooks',
        connected: !!prefs?.quickbooks_refresh_token,
        lastSync: lastSyncBySource.quickbooks || null,
        details: prefs?.quickbooks_realm_id ? `Realm: ${prefs.quickbooks_realm_id}` : undefined,
      },
    ]

    return NextResponse.json({ connectors })
  } catch (error) {
    console.error('Status API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getLastSyncTimes(
  client: Awaited<ReturnType<typeof createServiceClient>>,
  orgId: string
): Promise<Record<string, string | null>> {
  const sources = ['gmail', 'calendar', 'hubspot', 'quickbooks']
  const result: Record<string, string | null> = {}

  for (const source of sources) {
    const { data } = await client
      .from('ingested_data')
      .select('ingested_at')
      .eq('organization_id', orgId)
      .eq('source', source)
      .order('ingested_at', { ascending: false })
      .limit(1)

    result[source] = data?.[0]?.ingested_at || null
  }

  return result
}
