import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
  const payload = JSON.parse(body)

  // Handle URL verification challenge (no signature check needed)
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge })
  }

  // Verify request signature
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
  // Dynamically import to keep the webhook handler lightweight
  const { parseCommand } = await import('@/lib/agents/command-parser')
  const { executeCommand } = await import('@/lib/agents/command-executor')

  // Look up partner by slack_user_id
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, organization_id')
    .eq('slack_user_id', event.user)
    .single()

  if (!profile) {
    console.warn(`No profile found for Slack user ${event.user}`)
    return
  }

  // Find the active briefing for threading context
  const today = new Date().toISOString().split('T')[0]
  const { data: briefing } = await supabaseAdmin
    .from('briefings')
    .select('id, slack_message_ts, slack_channel_id')
    .eq('partner_id', profile.id)
    .eq('briefing_date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Parse the user's message
  const command = await parseCommand(event.text, {
    briefingId: briefing?.id,
    threadTs: event.thread_ts || briefing?.slack_message_ts,
  })

  // Execute the command
  await executeCommand(command, {
    partnerId: profile.id,
    organizationId: profile.organization_id,
    channelId: event.channel,
    threadTs: event.thread_ts || briefing?.slack_message_ts || event.ts,
    teamId,
  })
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

  // Look up partner
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, organization_id')
    .eq('slack_user_id', event.user)
    .single()

  if (!profile) return

  await handleReaction(event.reaction, {
    partnerId: profile.id,
    organizationId: profile.organization_id,
    channelId: event.item.channel,
    messageTs: event.item.ts,
    teamId,
  })
}
