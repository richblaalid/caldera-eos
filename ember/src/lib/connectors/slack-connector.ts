import { WebClient, type ChatPostMessageResponse, type KnownBlock } from '@slack/web-api'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Get a Slack WebClient initialized with the bot token from slack_settings.
 */
export async function getSlackClient(organizationId: string): Promise<WebClient | null> {
  const { data } = await supabaseAdmin
    .from('slack_settings')
    .select('bot_token')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .single()

  if (!data?.bot_token) {
    console.error('No active Slack bot token for organization:', organizationId)
    return null
  }

  return new WebClient(data.bot_token)
}

/**
 * Post a message with Block Kit blocks to a Slack channel or DM.
 * Returns the message timestamp (ts) for threading.
 */
export async function postBlockMessage(
  client: WebClient,
  channel: string,
  text: string,
  blocks: Record<string, unknown>[]
): Promise<ChatPostMessageResponse | null> {
  try {
    const result = await client.chat.postMessage({
      channel,
      text, // Fallback text for notifications
      blocks: blocks as unknown as KnownBlock[],
    })

    return result
  } catch (error) {
    console.error('Slack postBlockMessage error:', error)
    return null
  }
}

/**
 * Post a threaded reply to an existing message.
 */
export async function postThreadReply(
  client: WebClient,
  channel: string,
  threadTs: string,
  text: string,
  blocks?: Record<string, unknown>[]
): Promise<ChatPostMessageResponse | null> {
  try {
    const result = await client.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text,
      blocks: blocks as unknown as KnownBlock[] | undefined,
    })

    return result
  } catch (error) {
    console.error('Slack postThreadReply error:', error)
    return null
  }
}

/**
 * Open a DM channel with a user and return the channel ID.
 */
export async function openDM(client: WebClient, userId: string): Promise<string | null> {
  try {
    const result = await client.conversations.open({ users: userId })
    return result.channel?.id || null
  } catch (error) {
    console.error('Slack openDM error:', error)
    return null
  }
}

/**
 * Post a system alert to the #ember-system channel.
 * Used for pipeline failures, connector errors, etc.
 */
export async function postSystemAlert(
  organizationId: string,
  title: string,
  details: string,
  severity: 'error' | 'warning' = 'error'
): Promise<void> {
  const channelName = process.env.SLACK_SYSTEM_CHANNEL || 'ember-system'

  try {
    const client = await getSlackClient(organizationId)
    if (!client) return

    const icon = severity === 'error' ? ':red_circle:' : ':warning:'
    const blocks: Record<string, unknown>[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${icon} *Ember System Alert*\n*${title}*`,
        },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: details },
      },
      {
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: `_${new Date().toISOString()}_`,
        }],
      },
    ]

    await client.chat.postMessage({
      channel: channelName,
      text: `${severity === 'error' ? 'ERROR' : 'WARNING'}: ${title}`,
      blocks: blocks as unknown as KnownBlock[],
    })
  } catch (error) {
    // Don't let alert failures cascade — just log
    console.error('Failed to post system alert:', error)
  }
}
