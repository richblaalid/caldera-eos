import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Verify Slack request signature using HMAC-SHA256.
 */
function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  body: string,
  signature: string
): boolean {
  // Reject requests older than 5 minutes
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5
  if (parseInt(timestamp, 10) < fiveMinutesAgo) return false

  const sigBasestring = `v0:${timestamp}:${body}`
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', signingSecret)
    .update(sigBasestring, 'utf8')
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(mySignature, 'utf8'),
    Buffer.from(signature, 'utf8')
  )
}

// POST /api/agents/events/slack
// Receives Slack Events API webhooks (DM messages, reactions, etc.)
export async function POST(request: NextRequest) {
  const body = await request.text()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payload: any
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Handle URL verification challenge (no signature check needed per Slack docs)
  if (payload.type === 'url_verification') {
    return new Response(payload.challenge as string, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // Verify request signature BEFORE any other processing
  const signingSecret = process.env.SLACK_SIGNING_SECRET
  if (!signingSecret) {
    console.error('SLACK_SIGNING_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const timestamp = request.headers.get('x-slack-request-timestamp') || ''
  const signature = request.headers.get('x-slack-signature') || ''

  if (!verifySlackSignature(signingSecret, timestamp, body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Reject Slack retries — our handler takes >3s due to AI calls,
  // so Slack retries thinking we failed. Acknowledge retries immediately.
  if (request.headers.get('x-slack-retry-num')) {
    return NextResponse.json({ ok: true })
  }

  // Acknowledge immediately (Slack requires response within 3 seconds)
  // Process the event asynchronously
  const event = payload.event
  if (!event) {
    return NextResponse.json({ ok: true })
  }

  // Ignore bot messages to prevent loops
  if (event.bot_id || event.subtype === 'bot_message') {
    return NextResponse.json({ ok: true })
  }

  // Route events
  try {
    if (event.type === 'message' && event.channel_type === 'im') {
      await handleDirectMessage(event, payload.team_id)
    } else if (event.type === 'reaction_added') {
      await handleReactionAdded(event, payload.team_id)
    }
  } catch (error) {
    // Log but don't fail — Slack will retry on 5xx
    console.error('Event processing error:', error)
  }

  return NextResponse.json({ ok: true })
}

/**
 * Handle DM messages — route through command parser and executor.
 */
async function handleDirectMessage(
  event: { user: string; text: string; channel: string; ts: string; thread_ts?: string },
  teamId: string
) {
  // Look up partner by slack_user_id, joining to get organization_id
  const admin = getSupabaseAdmin()
  const { data: profileRows, error: profileError } = await admin
    .from('profiles')
    .select('id, slack_user_id')
    .eq('slack_user_id', event.user)

  const profileRow = profileRows?.[0]
  if (!profileRow) {
    console.warn(`No profile found for Slack user ${event.user}`, profileError?.message || '')
    return
  }

  const { data: membership, error: membershipError } = await getSupabaseAdmin()
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', profileRow.id)
    .limit(1)
    .single()

  if (!membership) {
    console.warn(`No organization found for profile ${profileRow.id}`, membershipError?.message)
    return
  }

  const profile = { id: profileRow.id, organization_id: membership.organization_id }
  console.log(`Slack DM from ${event.user}: org=${profile.organization_id}, text="${event.text.substring(0, 50)}"`)

  // Try to handle as a scorecard value reply first (e.g. "Billable Utilization: 75")
  const handled = await tryScorecardReply(event.text, profile, event.channel, event.thread_ts || event.ts)
  if (handled) {
    console.log('Handled as scorecard reply')
    return
  }

  // Dynamically import to keep the webhook handler lightweight
  const { parseCommand } = await import('@/lib/agents/command-parser')
  const { executeCommand } = await import('@/lib/agents/command-executor')

  // Find the active briefing for threading context
  const today = new Date().toISOString().split('T')[0]
  const { data: briefing } = await getSupabaseAdmin()
    .from('briefings')
    .select('id, slack_message_ts, slack_channel_id')
    .eq('partner_id', profile.id)
    .eq('briefing_date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  console.log(`Briefing lookup: ${briefing ? `found ${briefing.id}` : 'none for today'}`)

  // Parse the user's message
  const command = await parseCommand(event.text, {
    briefingId: briefing?.id,
    threadTs: event.thread_ts || briefing?.slack_message_ts,
  })

  console.log(`Parsed command: ${command.command_type}`, command.parameters)

  // If user sent a top-level DM (not in a thread), reply directly in the conversation.
  // Only thread on the briefing if the user explicitly replied in the briefing thread.
  const threadTs = event.thread_ts || event.ts

  // Execute the command
  await executeCommand(command, {
    partnerId: profile.id,
    organizationId: profile.organization_id,
    channelId: event.channel,
    threadTs,
    teamId,
  })

  console.log('Command executed successfully')
}

/**
 * Try to parse a Slack DM as a scorecard value reply.
 * Matches patterns like "Billable Utilization: 75" or "Bench Utilization Rate: 100".
 * Supports multiple metrics on separate lines.
 * Returns true if at least one metric value was recorded.
 */
async function tryScorecardReply(
  text: string,
  profile: { id: string; organization_id: string },
  channelId: string,
  threadTs: string
): Promise<boolean> {
  // Match lines like "Metric Name: 42.5" or "Metric Name: 42"
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const valuePattern = /^(.+?):\s*([\d,.]+)\s*$/

  const parsed: Array<{ name: string; value: number }> = []
  for (const line of lines) {
    const match = line.match(valuePattern)
    if (!match) continue
    const name = match[1].trim()
    const value = parseFloat(match[2].replace(/,/g, ''))
    if (!isNaN(value) && isFinite(value) && value >= 0 && value <= 1_000_000 && name.length > 2) {
      parsed.push({ name, value })
    }
  }

  if (parsed.length === 0) return false

  const sb = getSupabaseAdmin()

  // Look up metrics by name (case-insensitive) for this org
  const { data: metrics } = await sb
    .from('scorecard_metrics')
    .select('id, name')
    .eq('organization_id', profile.organization_id)
    .eq('is_active', true)

  if (!metrics || metrics.length === 0) return false

  const matched: Array<{ metricId: string; metricName: string; value: number }> = []

  for (const p of parsed) {
    const metric = metrics.find(m => m.name.toLowerCase() === p.name.toLowerCase())
    if (metric) {
      matched.push({ metricId: metric.id, metricName: metric.name, value: p.value })
    }
  }

  if (matched.length === 0) return false

  // Compute current week start (Monday)
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  const weekOf = d.toISOString().split('T')[0]

  const results: string[] = []

  for (const m of matched) {
    const { error } = await sb
      .from('scorecard_entries')
      .upsert(
        {
          metric_id: m.metricId,
          week_of: weekOf,
          value: m.value,
          notes: `[Slack] Entered by ${profile.id}`,
        },
        { onConflict: 'metric_id,week_of' }
      )

    if (error) {
      results.push(`:x: ${m.metricName} — failed to save`)
    } else {
      results.push(`:white_check_mark: *${m.metricName}*: ${m.value} recorded for week of ${weekOf}`)
    }
  }

  // Reply in thread with confirmation
  const { getSlackClient, postThreadReply } = await import('@/lib/connectors/slack-connector')
  const client = await getSlackClient(profile.organization_id)
  if (client) {
    await postThreadReply(client, channelId, threadTs, results.join('\n'))
  }

  return true
}

/**
 * Handle emoji reactions — map to approve/reject/defer commands.
 */
async function handleReactionAdded(
  event: {
    user: string
    reaction: string
    item: { type: string; channel: string; ts: string }
  },
  teamId: string
) {
  if (event.item.type !== 'message') return

  // Dynamically import
  const { handleReaction } = await import('@/lib/agents/command-executor')

  // Look up partner by slack_user_id, joining to get organization_id
  const { data: profileRow } = await getSupabaseAdmin()
    .from('profiles')
    .select('id')
    .eq('slack_user_id', event.user)
    .single()

  if (!profileRow) return

  const { data: membership } = await getSupabaseAdmin()
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', profileRow.id)
    .limit(1)
    .single()

  if (!membership) return

  const profile = { id: profileRow.id, organization_id: membership.organization_id }

  await handleReaction(event.reaction, {
    partnerId: profile.id,
    organizationId: profile.organization_id,
    channelId: event.item.channel,
    messageTs: event.item.ts,
    teamId,
  })
}
