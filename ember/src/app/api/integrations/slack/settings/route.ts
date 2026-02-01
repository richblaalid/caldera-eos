import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getChannels, getSlackUsers, testConnection } from '@/lib/slack'

// GET /api/integrations/slack/settings - Get Slack settings and available channels
export async function GET() {
  try {
    const supabase = await createClient()

    // Check authentication
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
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    // Get Slack settings
    const { data: settings } = await supabase
      .from('slack_settings')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .single()

    if (!settings || !settings.bot_token) {
      return NextResponse.json({
        connected: false,
        settings: null,
        channels: [],
        users: [],
      })
    }

    // Test connection and get channels
    const testResult = await testConnection(settings.bot_token)

    if (!testResult.ok) {
      return NextResponse.json({
        connected: false,
        error: 'Token expired or invalid',
        settings: null,
        channels: [],
        users: [],
      })
    }

    const [channels, slackUsers] = await Promise.all([
      getChannels(settings.bot_token),
      getSlackUsers(settings.bot_token),
    ])

    return NextResponse.json({
      connected: true,
      team: testResult.team,
      settings: {
        channel_id: settings.channel_id,
        channel_name: settings.channel_name,
        is_active: settings.is_active,
      },
      channels,
      users: slackUsers,
    })
  } catch (error) {
    console.error('Slack settings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/integrations/slack/settings - Update Slack settings
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { channel_id, channel_name, is_active } = body

    // Get user's organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    // Update settings
    const { data, error } = await supabase
      .from('slack_settings')
      .update({
        channel_id,
        channel_name,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', membership.organization_id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update Slack settings:', error)
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Slack settings PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/integrations/slack/settings - Disconnect Slack
export async function DELETE() {
  try {
    const supabase = await createClient()

    // Check authentication
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
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    // Clear Slack settings
    const { error } = await supabase
      .from('slack_settings')
      .update({
        bot_token: null,
        channel_id: null,
        channel_name: null,
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', membership.organization_id)

    if (error) {
      console.error('Failed to disconnect Slack:', error)
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Slack settings DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
