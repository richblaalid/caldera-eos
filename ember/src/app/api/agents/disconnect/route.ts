import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/agents/disconnect - Disconnect an integration
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { connector } = await request.json()
    if (!connector || !['google', 'slack', 'quickbooks', 'grain'].includes(connector)) {
      return NextResponse.json({ error: 'Invalid connector' }, { status: 400 })
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

    if (connector === 'google') {
      await serviceClient
        .from('partner_preferences')
        .update({ google_refresh_token: null })
        .eq('organization_id', orgId)
        .eq('partner_id', user.id)
    }

    if (connector === 'slack') {
      await serviceClient
        .from('slack_settings')
        .update({ bot_token: null, is_active: false })
        .eq('organization_id', orgId)
    }

    if (connector === 'quickbooks') {
      await serviceClient
        .from('partner_preferences')
        .update({ quickbooks_refresh_token: null, quickbooks_realm_id: null })
        .eq('organization_id', orgId)
        .eq('partner_id', user.id)
    }

    if (connector === 'grain') {
      await serviceClient
        .from('partner_preferences')
        .update({ grain_refresh_token: null, grain_client_id: null })
        .eq('organization_id', orgId)
        .eq('partner_id', user.id)
    }

    return NextResponse.json({ success: true, connector })
  } catch (error) {
    console.error('Disconnect error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
