import { google, type gmail_v1 } from 'googleapis'
import Anthropic from '@anthropic-ai/sdk'
import { createAuthenticatedGoogleClient } from './google-auth'
import type { DataConnector, ConnectorPullParams, ConnectorResult, ConnectorRecord, ConnectorError } from './types'
import type { EmailCategory, IngestedEntities } from '@/types/agents'

const anthropic = new Anthropic()

/**
 * Gmail connector that pulls emails incrementally using historyId,
 * classifies them via Haiku, and extracts entities.
 */
export const gmailConnector: DataConnector = {
  source: 'gmail',

  async pull(params: ConnectorPullParams): Promise<ConnectorResult> {
    const { organizationId, config } = params
    const refreshToken = config.google_refresh_token as string
    const lastHistoryId = config.google_history_id as string | undefined

    if (!refreshToken) {
      return { records: [], errors: [{ code: 'NO_TOKEN', message: 'No Google refresh token', recoverable: false }] }
    }

    const auth = createAuthenticatedGoogleClient(refreshToken)
    const gmail = google.gmail({ version: 'v1', auth })

    const errors: ConnectorError[] = []
    let messages: gmail_v1.Schema$Message[] = []
    let newHistoryId: string | undefined

    try {
      if (lastHistoryId) {
        // Incremental sync using history
        const result = await fetchHistory(gmail, lastHistoryId)
        messages = result.messages
        newHistoryId = result.historyId
      } else {
        // Full initial sync — last 24 hours
        const result = await fetchRecent(gmail)
        messages = result.messages
        newHistoryId = result.historyId
      }
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string }
      if (err.code === 404) {
        // historyId expired, do full sync
        try {
          const result = await fetchRecent(gmail)
          messages = result.messages
          newHistoryId = result.historyId
        } catch (fullSyncError: unknown) {
          const fsErr = fullSyncError as { message?: string }
          errors.push({ code: 'FULL_SYNC_FAILED', message: fsErr.message || 'Full sync failed', recoverable: true })
          return { records: [], errors }
        }
      } else {
        errors.push({ code: 'HISTORY_FAILED', message: err.message || 'History fetch failed', recoverable: true })
        return { records: [], errors }
      }
    }

    // Classify and extract entities from messages
    const records: ConnectorRecord[] = []
    for (const message of messages) {
      try {
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date'],
        })

        const headers = fullMessage.data.payload?.headers || []
        const from = getHeader(headers, 'From')
        const to = getHeader(headers, 'To')
        const subject = getHeader(headers, 'Subject')
        const date = getHeader(headers, 'Date')
        const snippet = fullMessage.data.snippet || ''

        const classification = await classifyEmail({ from, subject, snippet })

        records.push({
          source: 'gmail',
          sourceId: message.id!,
          dataType: 'email',
          payload: {
            from,
            to,
            subject,
            snippet,
            category: classification.category,
            priority: classification.priority,
            action_needed: classification.action_needed,
          },
          rawPayload: { message_id: message.id, thread_id: message.threadId },
          entities: classification.entities,
          relevanceTags: [classification.category, classification.priority],
          sourceTimestamp: date ? new Date(date).toISOString() : null,
        })
      } catch (msgError: unknown) {
        const mErr = msgError as { message?: string }
        errors.push({ code: 'MESSAGE_FETCH_FAILED', message: `Failed to fetch message ${message.id}: ${mErr.message}`, recoverable: true })
      }
    }

    return {
      records,
      syncState: newHistoryId ? { google_history_id: newHistoryId } : undefined,
      errors,
    }
  },
}

/**
 * Fetch message IDs from Gmail history (incremental sync).
 */
async function fetchHistory(gmail: gmail_v1.Gmail, historyId: string) {
  const messages: gmail_v1.Schema$Message[] = []
  let pageToken: string | undefined
  let latestHistoryId = historyId

  do {
    const response = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: historyId,
      historyTypes: ['messageAdded'],
      pageToken,
    })

    if (response.data.history) {
      for (const historyItem of response.data.history) {
        if (historyItem.messagesAdded) {
          for (const added of historyItem.messagesAdded) {
            if (added.message) {
              messages.push(added.message)
            }
          }
        }
      }
    }

    latestHistoryId = response.data.historyId || latestHistoryId
    pageToken = response.data.nextPageToken || undefined
  } while (pageToken)

  return { messages: deduplicateMessages(messages), historyId: latestHistoryId }
}

/**
 * Fetch recent emails (last 24 hours) for initial sync.
 */
async function fetchRecent(gmail: gmail_v1.Gmail) {
  const oneDayAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)
  const messages: gmail_v1.Schema$Message[] = []

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: `after:${oneDayAgo}`,
    maxResults: 50,
  })

  if (response.data.messages) {
    messages.push(...response.data.messages)
  }

  // Get current historyId from profile
  const profile = await gmail.users.getProfile({ userId: 'me' })
  const historyId = profile.data.historyId || ''

  return { messages, historyId }
}

function deduplicateMessages(messages: gmail_v1.Schema$Message[]): gmail_v1.Schema$Message[] {
  const seen = new Set<string>()
  return messages.filter(m => {
    if (!m.id || seen.has(m.id)) return false
    seen.add(m.id)
    return true
  })
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string {
  return headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || ''
}

/**
 * Classify an email using Haiku for speed and cost efficiency.
 */
async function classifyEmail(email: { from: string; subject: string; snippet: string }): Promise<{
  category: EmailCategory
  entities: IngestedEntities
  action_needed: boolean
  priority: 'high' | 'medium' | 'low'
}> {
  try {
    const response = await anthropic.messages.create({
      model: process.env.AGENT_FAST_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Classify this email and extract entities. Respond ONLY with valid JSON.

From: ${email.from}
Subject: ${email.subject}
Preview: ${email.snippet}

JSON format:
{
  "category": "client" | "prospect" | "vendor" | "internal" | "newsletter" | "other",
  "priority": "high" | "medium" | "low",
  "action_needed": true/false,
  "entities": {
    "people": ["name1"],
    "companies": ["company1"],
    "action_items": ["action1"],
    "topics": ["topic1"]
  }
}`
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = JSON.parse(text)

    return {
      category: parsed.category || 'other',
      priority: parsed.priority || 'low',
      action_needed: parsed.action_needed || false,
      entities: {
        people: parsed.entities?.people || [],
        companies: parsed.entities?.companies || [],
        action_items: parsed.entities?.action_items || [],
        topics: parsed.entities?.topics || [],
      },
    }
  } catch {
    // Fallback classification if AI fails
    return {
      category: 'other',
      priority: 'low',
      action_needed: false,
      entities: {},
    }
  }
}
