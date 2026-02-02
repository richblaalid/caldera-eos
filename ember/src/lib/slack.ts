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
    'groups:read', // For private channels
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
  // Fetch public and private channels separately (requires different scopes)
  const [publicResponse, privateResponse] = await Promise.all([
    fetch(`${SLACK_API_BASE}/conversations.list?types=public_channel&limit=200`, {
      headers: { Authorization: `Bearer ${botToken}` },
    }),
    fetch(`${SLACK_API_BASE}/conversations.list?types=private_channel&limit=200`, {
      headers: { Authorization: `Bearer ${botToken}` },
    }),
  ])

  const [publicData, privateData] = await Promise.all([
    publicResponse.json(),
    privateResponse.json(),
  ])

  if (!publicData.ok && !privateData.ok) {
    console.error('Slack channels error:', publicData.error || privateData.error)
    return []
  }

  const publicChannels = publicData.ok ? (publicData.channels || []) : []
  const privateChannels = privateData.ok ? (privateData.channels || []) : []
  const allChannels = [...publicChannels, ...privateChannels]

  return allChannels.map((c: SlackChannel) => ({
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
  pendingSlackUserIds: string[],
  pendingCount: number,
  assessmentUrl: string
): object[] {
  const mentions = pendingSlackUserIds.map(id => `<@${id}>`).join(' ')

  // Build pending text: use @mentions if available, otherwise show count
  let pendingText: string
  if (pendingCount === 0) {
    pendingText = '_Everyone has completed!_'
  } else if (mentions) {
    pendingText = mentions
  } else {
    pendingText = `${pendingCount} team member(s) still need to complete`
  }

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
        text: `*Pending:* ${pendingText}`,
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

// Look up a Slack user by email
export async function findSlackUserByEmail(botToken: string, email: string): Promise<SlackUser | null> {
  // Use users.lookupByEmail for direct lookup (more efficient than fetching all users)
  const response = await fetch(
    `${SLACK_API_BASE}/users.lookupByEmail?email=${encodeURIComponent(email)}`,
    {
      headers: {
        Authorization: `Bearer ${botToken}`,
      },
    }
  )

  const data = await response.json()

  if (!data.ok) {
    // user_not_found is expected for emails not in Slack
    if (data.error !== 'users_not_found') {
      console.error('Slack lookupByEmail error:', data.error)
    }
    return null
  }

  const u = data.user
  return {
    id: u.id,
    name: u.name,
    real_name: u.real_name,
    profile: {
      email: u.profile?.email,
      display_name: u.profile?.display_name,
    },
  }
}

// Sync Slack user IDs for all profiles in an organization
export async function syncSlackUserIds(
  botToken: string,
  profiles: Array<{ id: string; email?: string | null }>
): Promise<Map<string, string>> {
  const emailToSlackId = new Map<string, string>()

  // Fetch all Slack users once (more efficient for multiple lookups)
  const slackUsers = await getSlackUsers(botToken)

  // Build email -> slack_id map (case-insensitive)
  const slackEmailMap = new Map<string, string>()
  for (const user of slackUsers) {
    if (user.profile.email) {
      slackEmailMap.set(user.profile.email.toLowerCase(), user.id)
    }
  }

  // Match profiles to Slack users
  for (const profile of profiles) {
    if (profile.email) {
      const slackId = slackEmailMap.get(profile.email.toLowerCase())
      if (slackId) {
        emailToSlackId.set(profile.id, slackId)
      }
    }
  }

  return emailToSlackId
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
