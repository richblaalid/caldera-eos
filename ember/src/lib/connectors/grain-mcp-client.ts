import Anthropic from '@anthropic-ai/sdk'

// =============================================
// Types
// =============================================

export interface GrainMeeting {
  id: string
  title: string
  date: string
  duration_minutes?: number
  participants?: string[]
  url?: string
}

export interface GrainTranscript {
  meetingId: string
  text: string
  speakers?: string[]
}

export interface GrainNotes {
  meetingId: string
  markdown: string
}

export interface GrainCoaching {
  meetingId: string
  markdown: string
}

// =============================================
// OAuth Token Refresh
// =============================================

let cachedToken: string | null = null
let tokenExpiresAt: number = 0

/**
 * Get a valid Grain MCP access token, refreshing if expired.
 * Grain OAuth tokens expire every 3600 seconds (1 hour).
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5-minute buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken
  }

  const refreshToken = process.env.GRAIN_MCP_REFRESH_TOKEN
  const clientId = process.env.GRAIN_MCP_CLIENT_ID
  const currentToken = process.env.GRAIN_MCP_TOKEN

  // Try to refresh if we have the refresh token and client ID
  if (refreshToken && clientId) {
    try {
      // Discover token endpoint from Grain's OAuth metadata
      const tokenEndpoint = await discoverTokenEndpoint()
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
        }),
      })

      if (response.ok) {
        const data = await response.json() as { access_token: string; expires_in: number }
        cachedToken = data.access_token
        tokenExpiresAt = Date.now() + data.expires_in * 1000
        return cachedToken
      }

      console.warn('Grain token refresh failed:', response.status, await response.text())
    } catch (err) {
      console.warn('Grain token refresh error:', err)
    }
  }

  // Fall back to env var token (may be expired)
  if (currentToken) {
    cachedToken = currentToken
    // Assume 1 hour from now if we don't know when it expires
    tokenExpiresAt = Date.now() + 60 * 60 * 1000
    return currentToken
  }

  throw new Error('No Grain MCP token available. Set GRAIN_MCP_TOKEN or GRAIN_MCP_REFRESH_TOKEN + GRAIN_MCP_CLIENT_ID.')
}

let cachedTokenEndpoint: string | null = null

async function discoverTokenEndpoint(): Promise<string> {
  if (cachedTokenEndpoint) return cachedTokenEndpoint

  // Try standard OAuth metadata discovery
  const baseUrl = new URL(process.env.GRAIN_MCP_URL || 'https://api.grain.com/_/mcp')
  const metadataUrl = `${baseUrl.origin}/.well-known/oauth-authorization-server`

  try {
    const response = await fetch(metadataUrl)
    if (response.ok) {
      const metadata = await response.json() as { token_endpoint: string }
      cachedTokenEndpoint = metadata.token_endpoint
      return cachedTokenEndpoint
    }
  } catch {
    // metadata not available
  }

  // Fallback: Grain's token endpoint (discovered from mcp-remote OAuth flow)
  cachedTokenEndpoint = `${baseUrl.origin}/oauth/token`
  return cachedTokenEndpoint
}

// =============================================
// MCP Connector API Client
// =============================================

/**
 * Send a prompt to Claude with Grain MCP tools attached.
 * Uses the Anthropic MCP Connector API (beta: mcp-client-2025-11-20).
 *
 * The response contains tool_use + tool_result blocks that Claude has
 * already resolved by calling the Grain MCP server. We extract the
 * final text response.
 */
async function callGrainMcp(prompt: string): Promise<{ text: string; rawContent: unknown[] }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const grainToken = await getAccessToken()
  const grainUrl = process.env.GRAIN_MCP_URL || 'https://api.grain.com/_/mcp'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (anthropic.beta as any).messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
    mcp_servers: [{
      type: 'url',
      url: grainUrl,
      name: 'grain',
      authorization_token: grainToken,
    }],
    tools: [{
      type: 'mcp_toolset',
      mcp_server_name: 'grain',
    }],
    betas: ['mcp-client-2025-11-20'],
  }) as { content: Array<{ type: string; text?: string; content?: unknown }> }

  // Extract text content from response
  const textBlocks = response.content.filter(b => b.type === 'text') as Array<{ type: 'text'; text: string }>
  const text = textBlocks.map(b => b.text).join('\n')

  return { text, rawContent: response.content as unknown[] }
}

/**
 * Extract JSON from MCP tool result blocks in the response.
 * The MCP Connector returns tool results as content blocks.
 */
function extractMcpToolResults(rawContent: unknown[]): unknown[] {
  const results: unknown[] = []
  for (const block of rawContent) {
    const b = block as { type: string; content?: unknown }
    if (b.type === 'mcp_tool_result' && b.content) {
      // content is an array of text blocks
      const contentBlocks = b.content as Array<{ type: string; text?: string }>
      for (const cb of contentBlocks) {
        if (cb.type === 'text' && cb.text) {
          try {
            results.push(JSON.parse(cb.text))
          } catch {
            results.push(cb.text)
          }
        }
      }
    }
  }
  return results
}

// =============================================
// Public API
// =============================================

/**
 * List meetings from Grain, optionally filtered by date.
 */
export async function listMeetings(since?: string): Promise<GrainMeeting[]> {
  const dateFilter = since ? ` Filter to meetings after ${since}.` : ''
  const prompt = `List all accessible meetings.${dateFilter} Return the meeting IDs, titles, dates, durations, and participant names. Use the list_meetings tool.`

  const { text, rawContent } = await callGrainMcp(prompt)

  // Try to parse structured data from tool results first
  const toolResults = extractMcpToolResults(rawContent)
  if (toolResults.length > 0) {
    return parseMeetingsFromToolResults(toolResults)
  }

  // Fall back to parsing Claude's text response
  return parseMeetingsFromText(text)
}

/**
 * Fetch the full transcript for a meeting.
 */
export async function fetchTranscript(meetingId: string): Promise<GrainTranscript | null> {
  const prompt = `Fetch the full transcript for meeting ID "${meetingId}". Include speaker labels. Use the fetch_meeting_transcript tool. Return the complete transcript text.`

  const { text, rawContent } = await callGrainMcp(prompt)

  const toolResults = extractMcpToolResults(rawContent)
  const transcriptText = toolResults.length > 0
    ? extractTranscriptFromToolResults(toolResults)
    : text

  if (!transcriptText || transcriptText.trim().length === 0) return null

  // Extract unique speaker names from "Speaker: text" patterns
  const speakerPattern = /^([A-Z][a-z]+ ?[A-Z]?[a-z]*)\s*:/gm
  const speakers = [...new Set(
    Array.from(transcriptText.matchAll(speakerPattern), m => m[1])
  )]

  return { meetingId, text: transcriptText, speakers }
}

/**
 * Fetch AI-generated notes for a meeting.
 */
export async function fetchNotes(meetingId: string): Promise<GrainNotes | null> {
  const prompt = `Fetch the AI-generated meeting notes for meeting ID "${meetingId}". Use the fetch_meeting_notes tool. Return the full notes content.`

  const { text, rawContent } = await callGrainMcp(prompt)

  const toolResults = extractMcpToolResults(rawContent)
  const notesText = toolResults.length > 0
    ? extractNotesFromToolResults(toolResults)
    : text

  if (!notesText || notesText.trim().length === 0) return null

  return { meetingId, markdown: notesText }
}

/**
 * Fetch AI-generated coaching feedback for a meeting.
 */
export async function fetchCoaching(meetingId: string): Promise<GrainCoaching | null> {
  const prompt = `Fetch the AI coaching feedback for meeting ID "${meetingId}". Use the fetch_meeting_coaching_feedback tool. Return the full coaching content.`

  try {
    const { text, rawContent } = await callGrainMcp(prompt)

    const toolResults = extractMcpToolResults(rawContent)
    const coachingText = toolResults.length > 0
      ? extractNotesFromToolResults(toolResults) // same structure as notes
      : text

    if (!coachingText || coachingText.trim().length === 0) return null
    return { meetingId, markdown: coachingText }
  } catch {
    // Coaching feedback may not exist for all meetings
    return null
  }
}

// =============================================
// Response Parsers
// =============================================

function parseMeetingsFromToolResults(results: unknown[]): GrainMeeting[] {
  const meetings: GrainMeeting[] = []
  for (const result of results) {
    // Grain list_meetings returns array of meeting objects
    if (Array.isArray(result)) {
      for (const item of result) {
        const m = item as Record<string, unknown>
        if (m.id || m.meeting_id) {
          meetings.push({
            id: (m.id || m.meeting_id) as string,
            title: (m.title || m.name || 'Untitled') as string,
            date: (m.date || m.start_time || m.created_at || '') as string,
            duration_minutes: m.duration_minutes as number | undefined,
            participants: m.participants as string[] | undefined,
            url: m.url as string | undefined,
          })
        }
      }
    } else if (typeof result === 'object' && result !== null) {
      // Single meeting or wrapper object
      const r = result as Record<string, unknown>
      if (r.meetings && Array.isArray(r.meetings)) {
        return parseMeetingsFromToolResults([r.meetings])
      }
      if (r.id || r.meeting_id) {
        meetings.push({
          id: (r.id || r.meeting_id) as string,
          title: (r.title || r.name || 'Untitled') as string,
          date: (r.date || r.start_time || r.created_at || '') as string,
          duration_minutes: r.duration_minutes as number | undefined,
          participants: r.participants as string[] | undefined,
          url: r.url as string | undefined,
        })
      }
    }
  }
  return meetings
}

function parseMeetingsFromText(text: string): GrainMeeting[] {
  // Attempt to extract meeting info from Claude's text response
  // This is a fallback — the structured tool results are preferred
  const meetings: GrainMeeting[] = []
  const lines = text.split('\n')

  for (const line of lines) {
    // Look for patterns like "1. Meeting Title (2026-02-25)" or "- **Title**: ..."
    const match = line.match(/(?:^[\d]+\.\s*|\-\s*)(?:\*\*)?(.+?)(?:\*\*)?\s*[-–—(]\s*(\d{4}[-/]\d{2}[-/]\d{2})/)
    if (match) {
      meetings.push({
        id: '', // Can't extract ID from text easily
        title: match[1].trim(),
        date: match[2],
      })
    }
  }

  return meetings
}

function extractTranscriptFromToolResults(results: unknown[]): string {
  for (const result of results) {
    if (typeof result === 'string') return result
    if (typeof result === 'object' && result !== null) {
      const r = result as Record<string, unknown>
      if (typeof r.transcript === 'string') return r.transcript
      if (typeof r.text === 'string') return r.text
      if (typeof r.content === 'string') return r.content
    }
  }
  return ''
}

function extractNotesFromToolResults(results: unknown[]): string {
  for (const result of results) {
    if (typeof result === 'string') return result
    if (typeof result === 'object' && result !== null) {
      const r = result as Record<string, unknown>
      if (typeof r.notes === 'string') return r.notes
      if (typeof r.content === 'string') return r.content
      if (typeof r.text === 'string') return r.text
      if (typeof r.markdown === 'string') return r.markdown
    }
  }
  return ''
}
