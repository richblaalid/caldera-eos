import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { postMessage, buildCheckupReminderBlocks } from '@/lib/slack'

// Use service role for cron job (no user session)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/cron/checkup-reminders - Send Slack reminders for active checkup periods
export async function GET(request: Request) {
  try {
    // Verify cron secret (Vercel cron protection)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('Unauthorized cron request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all organizations with active Slack integration
    const { data: slackSettings, error: settingsError } = await supabaseAdmin
      .from('slack_settings')
      .select('*')
      .eq('is_active', true)
      .not('bot_token', 'is', null)
      .not('channel_id', 'is', null)

    if (settingsError) {
      console.error('Failed to fetch Slack settings:', settingsError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!slackSettings || slackSettings.length === 0) {
      return NextResponse.json({ message: 'No active Slack integrations' })
    }

    const results: Array<{ org: string; status: string; sent?: boolean }> = []

    for (const settings of slackSettings) {
      // Get active checkup period for this organization
      const { data: activePeriod } = await supabaseAdmin
        .from('checkup_periods')
        .select('*')
        .eq('organization_id', settings.organization_id)
        .eq('is_active', true)
        .single()

      if (!activePeriod) {
        results.push({
          org: settings.organization_id,
          status: 'no_active_period',
        })
        continue
      }

      // Get org members
      const { data: members } = await supabaseAdmin
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', settings.organization_id)

      if (!members || members.length === 0) {
        results.push({
          org: settings.organization_id,
          status: 'no_members',
        })
        continue
      }

      const memberIds = members.map(m => m.user_id)

      // Get completions for this period
      const { data: completions } = await supabaseAdmin
        .from('checkup_completions')
        .select('user_id')
        .eq('period_id', activePeriod.id)

      const completedIds = new Set(completions?.map(c => c.user_id) || [])

      // Find pending members
      const pendingMemberIds = memberIds.filter(id => !completedIds.has(id))

      if (pendingMemberIds.length === 0) {
        results.push({
          org: settings.organization_id,
          status: 'all_completed',
        })
        continue
      }

      // Get Slack user IDs for pending members
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, slack_user_id')
        .in('id', pendingMemberIds)
        .not('slack_user_id', 'is', null)

      const slackUserIds = profiles?.map(p => p.slack_user_id).filter(Boolean) as string[] || []

      // Build and send reminder
      const assessmentUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://caldera-eos.vercel.app'}/dashboard/checkup/assess`
      const blocks = buildCheckupReminderBlocks(
        activePeriod.name,
        slackUserIds,
        pendingMemberIds.length,
        assessmentUrl
      )

      const text = `EOS Checkup Reminder: ${activePeriod.name} is open. ${pendingMemberIds.length} team member(s) still need to complete.`

      const sent = await postMessage(
        settings.bot_token,
        settings.channel_id,
        text,
        blocks
      )

      results.push({
        org: settings.organization_id,
        status: 'reminder_sent',
        sent,
      })
    }

    return NextResponse.json({
      message: 'Checkup reminders processed',
      results,
    })
  } catch (error) {
    console.error('Checkup reminders cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
