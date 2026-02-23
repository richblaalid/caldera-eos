import { createClient } from '@supabase/supabase-js'
import { getSlackClient, postBlockMessage, openDM } from '@/lib/connectors/slack-connector'
import { markBriefingDelivered } from './ea-briefing'
import type { BriefingInsert } from '@/types/agents'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Format a briefing into Slack Block Kit blocks.
 */
export function formatBriefingBlocks(briefing: BriefingInsert): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = []

  // Header
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: `Morning Briefing — ${briefing.briefing_date}`, emoji: true },
  })

  // Tier 1: Urgent
  const tier1 = briefing.tier1_urgent || []
  if (tier1.length > 0) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '*:rotating_light: Needs Your Attention*' },
    })
    for (const item of tier1) {
      const actionTag = item.action_needed ? ' :point_left:' : ''
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${item.id}.* *${item.title}*${actionTag}\n${item.detail} _[${item.source}]_`,
        },
      })
    }
  }

  // Tier 2: Business
  const tier2 = briefing.tier2_business || []
  if (tier2.length > 0) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '*:briefcase: Business Updates*' },
    })
    for (const item of tier2) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${item.id}.* ${item.title}\n${item.detail} _[${item.source}]_`,
        },
      })
    }
  }

  // Tier 3: Industry (compact)
  const tier3 = briefing.tier3_industry || []
  if (tier3.length > 0) {
    blocks.push({ type: 'divider' })
    const tier3Text = tier3
      .map(item => `• ${item.title} — ${item.detail}`)
      .join('\n')
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*:newspaper: FYI*\n${tier3Text}` },
    })
  }

  // Agent Work Queue
  const workQueue = briefing.agent_work_queue || []
  if (workQueue.length > 0) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '*:robot_face: Agent Work Queue*\n_Reply with "approve N", "reject N", or "defer N" to respond._' },
    })
    for (const item of workQueue) {
      const statusIcon = item.status === 'pending_review' ? ':yellow_circle:' : ':white_circle:'
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${statusIcon} *${item.id}.* [${item.agent_name}] ${item.title}\n${item.summary}`,
        },
      })
    }
  }

  // Footer
  blocks.push({ type: 'divider' })
  blocks.push({
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: '_Reply to this message to interact with Ember. Use approve/reject/defer or ask a question._',
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
