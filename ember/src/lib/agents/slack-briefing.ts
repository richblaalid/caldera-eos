import { createClient } from '@supabase/supabase-js'
import { getSlackClient, postBlockMessage, openDM } from '@/lib/connectors/slack-connector'
import { markBriefingDelivered } from './ea-briefing'
import type { BriefingInsert } from '@/types/agents'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Agent personality emojis — each AI assistant has a unique identity
const AGENT_EMOJI: Record<string, string> = {
  'ea': ':crystal_ball:',                    // Ember EA — the oracle
  'financial-strategist': ':bank:',          // Finance brain
  'bd-strategist': ':dart:',                 // Pipeline hunter
  'operations-architect': ':gear:',          // Ops engine
  'marketing-strategist': ':mega:',          // Marketing CMO
  'pattern-detector': ':mag:',               // Pattern detection
  'product-innovation': ':rocket:',           // Innovation radar
  'scorecard-automation': ':bar_chart:',     // Metrics tracker
  'meeting-prep': ':memo:',                  // Pre-call intel
  'l10-prep': ':calendar:',                  // L10 prep
  'nudge-engine': ':bell:',                  // Accountability nudges
}

/** Get a time-of-day greeting */
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** Format a date as "Monday, Feb 23" */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

/** Get the emoji for an agent, with fallback */
function agentEmoji(agentId: string): string {
  return AGENT_EMOJI[agentId] || ':robot_face:'
}

/** Map source string to a status card emoji */
function sourceEmoji(source: string): string {
  const s = source.toLowerCase()
  if (s.includes('rock') || s.includes('todo')) return ':green-card:'
  if (s.includes('scorecard') || s.includes('financial')) return ':yellow-card:'
  if (s.includes('calendar')) return ':date:'
  if (s.includes('email')) return ':email:'
  if (s.includes('pipeline') || s.includes('deal')) return ':dart:'
  return ''
}

/**
 * Format a briefing into Slack Block Kit blocks.
 */
export function formatBriefingBlocks(briefing: BriefingInsert): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = []
  const tier1 = briefing.tier1_urgent || []
  const tier2 = briefing.tier2_business || []
  const tier3 = briefing.tier3_industry || []
  const workQueue = briefing.agent_work_queue || []

  // Header with greeting
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: `${getGreeting()} — ${formatDate(briefing.briefing_date)}`, emoji: true },
  })

  // Quick stats line
  const statsLine = [
    tier1.length > 0 ? `:red-card: ${tier1.length} urgent` : null,
    tier2.length > 0 ? `${tier2.length} updates` : null,
    workQueue.length > 0 ? `${workQueue.length} items for review` : null,
  ].filter(Boolean).join(' · ')
  if (statsLine) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: statsLine }],
    })
  }

  // Tier 1: Urgent
  if (tier1.length > 0) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: ':rotating_light: *Needs Your Attention*' },
    })
    for (const item of tier1) {
      const actionTag = item.action_needed ? '  :point_right: _Action needed_' : ''
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `> *${item.title}*${actionTag}\n> ${item.detail}`,
        },
      })
    }
  }

  // Tier 2: Business
  if (tier2.length > 0) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: ':briefcase: *Business Updates*' },
    })
    const tier2Text = tier2
      .map(item => {
        const emoji = sourceEmoji(item.source)
        return `${emoji ? emoji + ' ' : ''}*${item.title}*\n${item.detail}`
      })
      .join('\n\n')
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: tier2Text },
    })
  }

  // Tier 3: Split into Industry Pulse (news with URL sources) and general FYI
  const newsItems = tier3.filter(item => item.source?.startsWith('http'))
  const fyiItems = tier3.filter(item => !item.source?.startsWith('http'))

  if (fyiItems.length > 0) {
    blocks.push({ type: 'divider' })
    const fyiText = fyiItems
      .map(item => `• ${item.title} — ${item.detail}`)
      .join('\n')
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `:bulb: *FYI*\n${fyiText}` },
    })
  }

  if (newsItems.length > 0) {
    blocks.push({ type: 'divider' })
    const newsText = newsItems
      .map(item => `• <${item.source}|${item.title}> — ${item.detail}`)
      .join('\n')
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `:newspaper: *Industry Pulse*\n${newsText}` },
    })
  }

  // Agent Work Queue (compact)
  if (workQueue.length > 0) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: ':crystal_ball: *Ember Work Queue*' },
    })
    const queueText = workQueue.map(item => {
      const emoji = agentEmoji(item.agent_id)
      const statusIcon = item.status === 'pending_review' ? ':yellow-card:' : ':green-card:'
      return `${statusIcon} *${item.id}.* ${item.title} _[${emoji} ${item.agent_name}]_\n      ${item.summary}`
    }).join('\n')
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: queueText },
    })
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '_Reply: "approve 1", "reject 2 — reason", or "defer 3 to Friday"_' }],
    })
  }

  // Footer
  blocks.push({ type: 'divider' })
  blocks.push({
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: '_Reply to chat with Ember · React with :white_check_mark: :pause_button: :x: for quick actions_',
    }],
  })

  return blocks
}

/**
 * Deliver a briefing to a partner's Slack DM.
 * Looks up their slack_user_id, opens a DM, posts the briefing,
 * and stores the message_ts for threading.
 */
export async function deliverBriefing(
  partnerId: string,
  organizationId: string,
  briefingId: string,
  briefing: BriefingInsert
): Promise<{ success: boolean; error?: string }> {
  // Get partner's Slack user ID
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('slack_user_id')
    .eq('id', partnerId)
    .single()

  if (!profile?.slack_user_id) {
    const msg = `Partner ${partnerId} has no slack_user_id${profileError ? `: ${profileError.message}` : ''}`
    console.error(msg)
    return { success: false, error: msg }
  }

  // Get Slack client
  const client = await getSlackClient(organizationId)
  if (!client) {
    const msg = `No active Slack bot token for org ${organizationId}`
    return { success: false, error: msg }
  }

  // Open DM channel
  const channelId = await openDM(client, profile.slack_user_id)
  if (!channelId) {
    const msg = `Failed to open DM with slack_user_id=${profile.slack_user_id}`
    console.error(msg)
    return { success: false, error: msg }
  }

  // Format and post
  const blocks = formatBriefingBlocks(briefing)
  const fallbackText = `Morning Briefing — ${briefing.briefing_date}`

  const result = await postBlockMessage(client, channelId, fallbackText, blocks)
  if (!result?.ts) {
    const msg = 'Failed to post briefing message to Slack'
    console.error(msg)
    return { success: false, error: msg }
  }

  // Store message_ts and channel_id for threading
  await markBriefingDelivered(briefingId, result.ts, channelId)

  return { success: true }
}
