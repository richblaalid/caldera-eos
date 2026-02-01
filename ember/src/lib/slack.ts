/**
 * Slack Web API Client for Ember
 * Handles OAuth, channel listing, and message posting
 */

const SLACK_API_BASE = 'https://slack.com/api'

export interface SlackChannel {
  id: string
  name: string
  is_private: boolean
  is_member: boolean
}

export interface SlackUser {
  id: string
  name: string
  real_name: string
  profile: {
    email?: string
    display_name?: string
  }
}

export interface SlackOAuthResponse {
  ok: boolean
  access_token?: string
  bot_user_id?: string
  team?: {
    id: string
    name: string
  }
  error?: string
}

// Generate OAuth URL for Slack authorization
export function getSlackOAuthUrl(state: string): string {
  const clientId = process.env.SLACK_CLIENT_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'https://caldera-eos.vercel.app'}/api/integrations/slack/callback`

  const scopes = [
    'chat:write',
    'users:read',
    'users:read.email',
    'channels:read',
  ].join(',')

  const params = new URLSearchParams({
    client_id: clientId!,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  })

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`
}

// Exchange OAuth code for access token
export async function exchangeCodeForToken(code: string): Promise<SlackOAuthResponse> {
  const clientId = process.env.SLACK_CLIENT_ID
  const clientSecret = process.env.SLACK_CLIENT_SECRET
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'https://caldera-eos.vercel.app'}/api/integrations/slack/callback`

  const response = await fetch(`${SLACK_API_BASE}/oauth.v2.access`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      code,
      redirect_uri: redirectUri,
    }),
  })

  return response.json()
}

// Fetch list of channels the bot can post to
export async function getChannels(botToken: string): Promise<SlackChannel[]> {
  const response = await fetch(`${SLACK_API_BASE}/conversations.list?types=public_channel,private_channel&limit=200`, {
    headers: {
      Authorization: `Bearer ${botToken}`,
    },
  })

  const data = await response.json()

  if (!data.ok) {
    console.error('Slack channels error:', data.error)
    return []
  }

  return data.channels
    .filter((c: SlackChannel) => c.is_member)
    .map((c: SlackChannel) => ({
      id: c.id,
      name: c.name,
      is_private: c.is_private,
      is_member: c.is_member,
    }))
}

// Fetch Slack users for profile mapping
export async function getSlackUsers(botToken: string): Promise<SlackUser[]> {
  const response = await fetch(`${SLACK_API_BASE}/users.list?limit=200`, {
    headers: {
      Authorization: `Bearer ${botToken}`,
    },
  })

  const data = await response.json()

  if (!data.ok) {
    console.error('Slack users error:', data.error)
    return []
  }

  return data.members
    .filter((u: { is_bot: boolean; deleted: boolean }) => !u.is_bot && !u.deleted)
    .map((u: SlackUser) => ({
      id: u.id,
      name: u.name,
      real_name: u.real_name,
      profile: {
        email: u.profile?.email,
        display_name: u.profile?.display_name,
      },
    }))
}

// Post a message to a channel
export async function postMessage(
  botToken: string,
  channelId: string,
  text: string,
  blocks?: object[]
): Promise<boolean> {
  const body: Record<string, unknown> = {
    channel: channelId,
    text,
  }

  if (blocks) {
    body.blocks = blocks
  }

  const response = await fetch(`${SLACK_API_BASE}/chat.postMessage`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()

  if (!data.ok) {
    console.error('Slack postMessage error:', data.error)
    return false
  }

  return true
}

// Build checkup reminder message with @mentions
export function buildCheckupReminderBlocks(
  periodName: string,
  pendingUserIds: string[],
  assessmentUrl: string
): object[] {
  const mentions = pendingUserIds.map(id => `<@${id}>`).join(' ')

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🔥 EOS Organizational Checkup Reminder',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${periodName}* is open for completion.`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Pending:* ${mentions || '_Everyone has completed!_'}`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Take Assessment',
            emoji: true,
          },
          url: assessmentUrl,
          style: 'primary',
        },
      ],
    },
  ]
}

// Test the bot token by calling auth.test
export async function testConnection(botToken: string): Promise<{ ok: boolean; team?: string; error?: string }> {
  const response = await fetch(`${SLACK_API_BASE}/auth.test`, {
    headers: {
      Authorization: `Bearer ${botToken}`,
    },
  })

  const data = await response.json()

  return {
    ok: data.ok,
    team: data.team,
    error: data.error,
  }
}
