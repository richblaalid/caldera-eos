import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createClient } from '@supabase/supabase-js'
import { daysAgo } from '@/lib/dates'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CalendarEvent {
  title: string
  start: string
  attendees: string[]
  event_type: string
  location?: string
  conference_link?: string
}

interface PreCallBrief {
  meetingTitle: string
  meetingTime: string
  brief: string
  attendees: string[]
}

/**
 * Generate a pre-call intelligence brief for an upcoming external meeting.
 * Compiles context from HubSpot deals, recent emails, prior meeting notes, and open action items.
 * Uses Claude Haiku for fast, cheap generation (runs per-meeting).
 */
export async function generatePreCallBrief(
  event: CalendarEvent,
  organizationId: string
): Promise<PreCallBrief | null> {
  // Extract client/company identifiers from attendees and title
  const clientIdentifiers = extractClientIdentifiers(event)
  if (clientIdentifiers.length === 0) return null

  // Gather context from multiple sources in parallel
  const [dealContext, emailContext, meetingHistory, openActions] = await Promise.all([
    getDealContext(organizationId, clientIdentifiers),
    getEmailContext(organizationId, clientIdentifiers),
    getMeetingHistory(organizationId, clientIdentifiers),
    getOpenActions(organizationId, clientIdentifiers),
  ])

  // Skip if we have no context to work with
  const hasContext = dealContext.length > 0 || emailContext.length > 0 || meetingHistory.length > 0 || openActions.length > 0
  if (!hasContext) return null

  // Build context prompt
  const contextSections: string[] = []

  if (dealContext.length > 0) {
    contextSections.push(`## HubSpot Deal Status\n${dealContext.map(d =>
      `- ${d.deal_name}: $${d.amount?.toLocaleString() || '?'} — Stage: ${d.stage} (close: ${d.close_date || 'TBD'})`
    ).join('\n')}`)
  }

  if (emailContext.length > 0) {
    contextSections.push(`## Recent Email Threads\n${emailContext.map(e =>
      `- ${e.subject} (${e.from}, ${e.date}): ${e.snippet}`
    ).join('\n')}`)
  }

  if (meetingHistory.length > 0) {
    contextSections.push(`## Prior Meeting Notes\n${meetingHistory.map(m =>
      `### ${m.title} (${m.date})\nKey points: ${m.key_points.join('; ')}\nAction items: ${m.action_items.join('; ')}`
    ).join('\n\n')}`)
  }

  if (openActions.length > 0) {
    contextSections.push(`## Open Action Items\n${openActions.map(a =>
      `- ${a.title}${a.owner ? ` (${a.owner})` : ''}${a.due_date ? ` — due ${a.due_date}` : ''}`
    ).join('\n')}`)
  }

  const prompt = `Generate a focused 5-line pre-call intelligence brief for this meeting:

**Meeting:** ${event.title}
**Time:** ${event.start}
**Attendees:** ${event.attendees.join(', ')}

${contextSections.join('\n\n')}

Format the brief as:
1. **Relationship status** — one line on where things stand with this client/prospect
2. **Last interaction** — what happened in the most recent touchpoint
3. **Open commitments** — action items or promises from either side
4. **Deal/financial context** — pipeline stage, amount, timeline
5. **Suggested talking points** — 2-3 specific things to bring up based on the data

Be concise and specific. Use actual names, dates, and dollar amounts.`

  const { text } = await generateText({
    model: anthropic(process.env.AGENT_FAST_MODEL || 'claude-haiku-4-5-20251001'),
    prompt,
    system: 'You are Ember, preparing a partner at Caldera for an upcoming meeting. Be direct and specific — no filler. The partner will read this in 30 seconds before walking into the meeting.',
  })

  return {
    meetingTitle: event.title,
    meetingTime: event.start,
    brief: text,
    attendees: event.attendees,
  }
}

// ============================================
// Context gathering helpers
// ============================================

function extractClientIdentifiers(event: CalendarEvent): string[] {
  const identifiers: string[] = []
  const calderaDomains = ['withcaldera.com', 'bko.group', 'gmail.com', 'yahoo.com', 'outlook.com', 'google.com']

  // Extract external domains from attendees
  for (const attendee of event.attendees) {
    const domain = attendee.split('@')[1]?.toLowerCase()
    if (domain && !calderaDomains.includes(domain)) {
      identifiers.push(domain)
    }
  }

  // Extract company name from title (pattern: "Company - Topic")
  const titleMatch = event.title.match(/^(.+?)\s*[-–—]\s*/)
  if (titleMatch && titleMatch[1].length > 2 && titleMatch[1].length < 50) {
    identifiers.push(titleMatch[1].trim().toLowerCase())
  }

  return [...new Set(identifiers)]
}

interface DealInfo {
  deal_name: string
  amount: number | null
  stage: string
  close_date: string | null
}

async function getDealContext(organizationId: string, identifiers: string[]): Promise<DealInfo[]> {
  const { data } = await supabaseAdmin
    .from('ingested_data')
    .select('payload')
    .eq('organization_id', organizationId)
    .eq('source', 'hubspot')
    .eq('data_type', 'deal')
    .order('source_timestamp', { ascending: false })
    .limit(50)

  if (!data) return []

  // Filter deals that match any client identifier
  return data
    .map(d => d.payload as Record<string, unknown>)
    .filter(deal => {
      const dealName = ((deal.deal_name as string) || '').toLowerCase()
      const company = ((deal.company_name as string) || '').toLowerCase()
      return identifiers.some(id => dealName.includes(id) || company.includes(id))
    })
    .slice(0, 3)
    .map(d => ({
      deal_name: (d.deal_name as string) || 'Unknown',
      amount: (d.amount as number) || null,
      stage: (d.stage as string) || 'Unknown',
      close_date: (d.close_date as string) || null,
    }))
}

interface EmailInfo {
  subject: string
  from: string
  date: string
  snippet: string
}

async function getEmailContext(organizationId: string, identifiers: string[]): Promise<EmailInfo[]> {
  const thirtyDaysAgo = daysAgo(30)

  const { data } = await supabaseAdmin
    .from('ingested_data')
    .select('payload, source_timestamp')
    .eq('organization_id', organizationId)
    .eq('source', 'gmail')
    .eq('data_type', 'email')
    .gte('source_timestamp', thirtyDaysAgo)
    .order('source_timestamp', { ascending: false })
    .limit(50)

  if (!data) return []

  return data
    .map(d => ({ payload: d.payload as Record<string, unknown>, ts: d.source_timestamp }))
    .filter(({ payload }) => {
      const from = ((payload.from as string) || '').toLowerCase()
      const subject = ((payload.subject as string) || '').toLowerCase()
      return identifiers.some(id => from.includes(id) || subject.includes(id))
    })
    .slice(0, 3)
    .map(({ payload, ts }) => ({
      subject: (payload.subject as string) || 'No subject',
      from: (payload.from as string) || 'Unknown',
      date: ts ? new Date(ts).toLocaleDateString() : 'Unknown',
      snippet: ((payload.snippet as string) || '').substring(0, 200),
    }))
}

interface MeetingInfo {
  title: string
  date: string
  key_points: string[]
  action_items: string[]
}

async function getMeetingHistory(organizationId: string, identifiers: string[]): Promise<MeetingInfo[]> {
  const ninetyDaysAgo = daysAgo(90)

  const { data } = await supabaseAdmin
    .from('ingested_data')
    .select('payload, source_timestamp')
    .eq('organization_id', organizationId)
    .eq('source', 'grain')
    .eq('data_type', 'transcript_summary')
    .gte('source_timestamp', ninetyDaysAgo)
    .order('source_timestamp', { ascending: false })
    .limit(20)

  if (!data) return []

  return data
    .map(d => ({ payload: d.payload as Record<string, unknown>, ts: d.source_timestamp }))
    .filter(({ payload }) => {
      const title = ((payload.meeting_title as string) || '').toLowerCase()
      const participants = (payload.participants as string[]) || []
      return identifiers.some(id =>
        title.includes(id) ||
        participants.some(p => p.toLowerCase().includes(id))
      )
    })
    .slice(0, 3)
    .map(({ payload, ts }) => ({
      title: (payload.meeting_title as string) || 'Untitled',
      date: ts ? new Date(ts).toLocaleDateString() : 'Unknown',
      key_points: (payload.key_points as string[]) || [],
      action_items: (payload.action_items as string[]) || [],
    }))
}

interface ActionItem {
  title: string
  owner: string | null
  due_date: string | null
}

async function getOpenActions(organizationId: string, identifiers: string[]): Promise<ActionItem[]> {
  // Search todos that might reference the client
  const { data } = await supabaseAdmin
    .from('todos')
    .select('title, owner_id, due_date')
    .eq('organization_id', organizationId)
    .eq('completed', false)
    .limit(50)

  if (!data) return []

  return data
    .filter(todo => {
      const title = (todo.title || '').toLowerCase()
      return identifiers.some(id => title.includes(id))
    })
    .slice(0, 5)
    .map(t => ({
      title: t.title,
      owner: null, // Would need join to profiles
      due_date: t.due_date,
    }))
}
