import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSlackUsers } from '@/lib/slack'

// POST /api/integrations/slack/sync-users - Sync Slack user IDs to profiles
export async function POST() {
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
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Get Slack settings for the org
    const { data: slackSettings } = await supabase
      .from('slack_settings')
      .select('bot_token')
      .eq('organization_id', membership.organization_id)
      .single()

    if (!slackSettings?.bot_token) {
      return NextResponse.json({ error: 'Slack not connected' }, { status: 400 })
    }

    // Fetch Slack users
    const slackUsers = await getSlackUsers(slackSettings.bot_token)
    if (slackUsers.length === 0) {
      return NextResponse.json({ error: 'No Slack users found' }, { status: 400 })
    }

    // Get org members with their profiles
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', membership.organization_id)

    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'No organization members found' }, { status: 400 })
    }

    const memberIds = members.map(m => m.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', memberIds)

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ error: 'No profiles found' }, { status: 400 })
    }

    // Build email -> slack_id map (case-insensitive)
    const slackEmailMap = new Map<string, string>()
    for (const slackUser of slackUsers) {
      if (slackUser.profile.email) {
        slackEmailMap.set(slackUser.profile.email.toLowerCase(), slackUser.id)
      }
    }

    // Match and update profiles
    const results = {
      matched: 0,
      notFound: 0,
      profiles: [] as Array<{ email: string; slackId: string | null }>
    }

    for (const profile of profiles) {
      const email = profile.email?.toLowerCase()
      const slackId = email ? slackEmailMap.get(email) : null

      if (slackId) {
        await supabase
          .from('profiles')
          .update({ slack_user_id: slackId })
          .eq('id', profile.id)
        results.matched++
      } else {
        results.notFound++
      }

      results.profiles.push({
        email: profile.email || 'unknown',
        slackId: slackId || null
      })
    }

    return NextResponse.json({
      success: true,
      ...results
    })
  } catch (error) {
    console.error('Slack sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync Slack users' },
      { status: 500 }
    )
  }
}
