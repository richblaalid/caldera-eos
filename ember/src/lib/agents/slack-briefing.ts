import { createClient } from '@supabase/supabase-js'
import { getSlackClient, postBlockMessage, openDM } from '@/lib/connectors/slack-connector'
import { markBriefingDelivered } from './ea-briefing'
import { escapeSlackMrkdwn, chunkForSlackSections } from '@/lib/slack-format'
import type { BriefingInsert, BriefingInsertV2, AgentWorkItem, AgentInsightItem } from '@/types/agents'

/** Shorthand for escaping user content */
const esc = escapeSlackMrkdwn

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

/** Get a time-of-day greeting in the partner's local timezone */
function getGreeting(timezone: string = 'America/Chicago'): string {
  const hour = parseInt(
    new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: timezone })
  )
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
export function formatBriefingBlocks(briefing: BriefingInsert, timezone: string = 'America/Chicago'): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = []
  const tier1 = briefing.tier1_urgent || []
  const tier2 = briefing.tier2_business || []
  const tier3 = briefing.tier3_industry || []
  const workQueue = briefing.agent_work_queue || []

  // Header with greeting (using partner's local timezone)
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: `${getGreeting(timezone)} — ${formatDate(briefing.briefing_date)}`, emoji: true },
  })

  // Quick stats line
  const statsLine = [
    tier1.length > 0 ? `:red-card: ${tier1.length} urgent` : null,
    tier2.length > 0 ? `${tier2.length} updates` : null,
    workQueue.length > 0 ? `${workQueue.length} for decision` : null,
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
          text: `> *${esc(item.title)}*${actionTag}\n> ${esc(item.detail)}`,
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
    const tier2Items = tier2.map(item => {
      const emoji = sourceEmoji(item.source)
      return `${emoji ? emoji + ' ' : ''}*${esc(item.title)}*\n${esc(item.detail)}`
    })
    for (const chunk of chunkForSlackSections(tier2Items)) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: chunk },
      })
    }
  }

  // Tier 3: Split into Industry Pulse (news with URL sources) and general FYI
  const newsItems = tier3.filter(item => item.source?.startsWith('http'))
  const fyiItems = tier3.filter(item => !item.source?.startsWith('http'))

  if (fyiItems.length > 0) {
    blocks.push({ type: 'divider' })
    const fyiLines = fyiItems.map(item => `• ${esc(item.title)} — ${esc(item.detail)}`)
    const fyiChunks = chunkForSlackSections(fyiLines, '\n')
    fyiChunks.forEach((chunk, i) => {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: i === 0 ? `:bulb: *FYI*\n${chunk}` : chunk },
      })
    })
  }

  if (newsItems.length > 0) {
    blocks.push({ type: 'divider' })
    const newsLines = newsItems.map(item => `• <${item.source}|${esc(item.title)}> — ${esc(item.detail)}`)
    const newsChunks = chunkForSlackSections(newsLines, '\n')
    newsChunks.forEach((chunk, i) => {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: i === 0 ? `:newspaper: *Industry Pulse*\n${chunk}` : chunk },
      })
    })
  }

  // "Needs Your Decision" — zone-2 items requiring partner action
  if (workQueue.length > 0) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: ':crystal_ball: *Needs Your Decision*' },
    })
    const queueLines = workQueue.map(item => {
      const emoji = agentEmoji(item.agent_id)
      return `:yellow-card: *${item.id}.* ${esc(item.title)} _[${emoji} ${esc(item.agent_name)}]_\n      ${esc(item.summary)}`
    })
    for (const chunk of chunkForSlackSections(queueLines, '\n')) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: chunk },
      })
    }
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '_Reply: "approve 1", "reject 2 — reason", or "defer 3 to Friday"_' }],
    })
  }

  // "Agent Insights" — informational one-liner per agent (v1 backward compat: may not exist)
  const insights = (briefing as BriefingInsert & { agent_insights?: AgentInsightItem[] }).agent_insights || []
  if (insights.length > 0) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: ':robot_face: *Agent Insights*' },
    })
    const insightLines = insights.map(item => {
      const emoji = agentEmoji(item.agent_id)
      return `${emoji} *${esc(item.agent_name)}* — ${esc(item.title)}`
    })
    for (const chunk of chunkForSlackSections(insightLines, '\n')) {
      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: chunk }],
      })
    }
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

// ============================================
// v2 Formatter — Tactical Daily + Strategic Monday
// ============================================

/** Urgency emoji for tactical items */
function urgencyEmoji(urgency: string): string {
  return urgency === 'must-do' ? ':red_circle:' : ':large_yellow_circle:'
}

/** Category emoji for strategic items */
function categoryEmoji(category: string): string {
  const map: Record<string, string> = {
    financial: ':bank:',
    pipeline: ':dart:',
    rocks: ':mountain:',
    positioning: ':mega:',
    pattern: ':mag:',
  }
  return map[category] || ':chart_with_upwards_trend:'
}

/** Trend indicator for strategic items */
function trendIcon(trend: string): string {
  const map: Record<string, string> = {
    improving: ':arrow_upper_right:',
    stable: ':arrow_right:',
    declining: ':arrow_lower_right:',
    new: ':new:',
  }
  return map[trend] || ''
}

/**
 * Format a v2 briefing into Slack Block Kit blocks.
 * Daily (Tue-Fri): numbered tactical items only.
 * Monday: tactical items + strategic pulse section.
 */
export function formatV2Blocks(briefing: BriefingInsertV2, timezone: string = 'America/Chicago'): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = []
  const tactical = briefing.tactical_items || []
  const strategic = briefing.strategic_items || []
  const fyi = briefing.fyi_item
  const workQueue = briefing.agent_work_queue || []
  const insights = briefing.agent_insights || []

  // Header with greeting
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: `${getGreeting(timezone)} — ${formatDate(briefing.briefing_date)}`, emoji: true },
  })

  // Quick stats
  const statsLine = [
    `${tactical.length} priorities`,
    workQueue.length > 0 ? `${workQueue.length} for decision` : null,
    insights.length > 0 ? `${insights.length} insights` : null,
    briefing.is_monday ? ':chart_with_upwards_trend: strategic pulse' : null,
  ].filter(Boolean).join(' · ')
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: statsLine }],
  })

  // Tactical items — numbered, action-oriented
  blocks.push({ type: 'divider' })
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: ':pushpin: *Today\'s Priorities*' },
  })

  for (const item of tactical) {
    const emoji = urgencyEmoji(item.urgency)
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *${item.id}.* ${esc(item.title)}\n      ${esc(item.context)}`,
      },
    })
  }

  // Strategic Pulse (Monday only)
  if (briefing.is_monday && strategic.length > 0) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: ':chart_with_upwards_trend: *Strategic Pulse*' },
    })

    for (const item of strategic) {
      const catEmoji = categoryEmoji(item.category)
      const trend = trendIcon(item.trend)
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${catEmoji} *${esc(item.title)}* ${trend}\n      ${esc(item.detail)}`,
        },
      })
    }
  }

  // FYI (single item, if present)
  if (fyi) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `:bulb: ${fyi.source?.startsWith('http') ? `<${fyi.source}|${esc(fyi.text)}>` : esc(fyi.text)}`,
      }],
    })
  }

  // "Needs Your Decision" — zone-2 items requiring partner action
  if (workQueue.length > 0) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: ':crystal_ball: *Needs Your Decision*' },
    })
    const queueLines = workQueue.map((item: AgentWorkItem) => {
      const emoji = agentEmoji(item.agent_id)
      return `:yellow-card: *${item.id}.* ${esc(item.title)} _[${emoji} ${esc(item.agent_name)}]_\n      ${esc(item.summary)}`
    })
    for (const chunk of chunkForSlackSections(queueLines, '\n')) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: chunk },
      })
    }
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '_Reply: "approve 1", "reject 2 — reason", or "defer 3 to Friday"_' }],
    })
  }

  // "Agent Insights" — informational one-liner per agent
  if (insights.length > 0) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: ':robot_face: *Agent Insights*' },
    })
    const insightLines = insights.map((item: AgentInsightItem) => {
      const emoji = agentEmoji(item.agent_id)
      return `${emoji} *${esc(item.agent_name)}* — ${esc(item.title)}`
    })
    for (const chunk of chunkForSlackSections(insightLines, '\n')) {
      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: chunk }],
      })
    }
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
 * Supports both v1 and v2 briefing formats.
 */
export async function deliverBriefing(
  partnerId: string,
  organizationId: string,
  briefingId: string,
  briefing: BriefingInsert | BriefingInsertV2,
  timezone: string = 'America/Chicago'
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

  // Format and post — route based on briefing version
  const isV2 = 'briefing_version' in briefing && briefing.briefing_version === 2
  const blocks = isV2
    ? formatV2Blocks(briefing as BriefingInsertV2, timezone)
    : formatBriefingBlocks(briefing as BriefingInsert, timezone)

  let fallbackText: string
  if (isV2) {
    const v2 = briefing as BriefingInsertV2
    const tactical = v2.tactical_items || []
    const wq = v2.agent_work_queue || []
    const ins = v2.agent_insights || []
    const parts = [
      `${tactical.length} priorities`,
      wq.length > 0 ? `${wq.length} for decision` : null,
      ins.length > 0 ? `${ins.length} insights` : null,
      v2.is_monday ? '+ strategic pulse' : null,
    ].filter(Boolean).join(', ')
    fallbackText = `Morning Briefing — ${briefing.briefing_date} | ${parts}`
  } else {
    const v1 = briefing as BriefingInsert
    const tier1 = v1.tier1_urgent || []
    const tier2 = v1.tier2_business || []
    const wq = v1.agent_work_queue || []
    const parts = [
      tier1.length > 0 ? `${tier1.length} urgent` : null,
      tier2.length > 0 ? `${tier2.length} updates` : null,
      wq.length > 0 ? `${wq.length} for decision` : null,
    ].filter(Boolean).join(', ')
    fallbackText = `Morning Briefing — ${briefing.briefing_date}${parts ? ` | ${parts}` : ''}`
  }

  const result = await postBlockMessage(client, channelId, fallbackText, blocks, { unfurl_links: false, unfurl_media: false })
  if (!result?.ts) {
    const msg = 'Failed to post briefing message to Slack'
    console.error(msg)
    return { success: false, error: msg }
  }

  // Store message_ts and channel_id for threading
  await markBriefingDelivered(briefingId, result.ts, channelId)

  return { success: true }
}
