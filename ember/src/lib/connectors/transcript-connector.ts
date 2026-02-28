import { createClient } from '@supabase/supabase-js'
import type { DataConnector, ConnectorPullParams, ConnectorResult, ConnectorRecord, ConnectorError } from './types'

type MeetingType = 'l10' | 'sales_call' | 'client_delivery' | '1on1' | 'internal'

const CALDERA_DOMAINS = ['withcaldera.com', 'bko.group']

/**
 * Transcript connector that pulls processed transcripts from the `transcripts` table,
 * classifies them by meeting type, and writes structured summaries into `ingested_data`
 * for the agent pipeline.
 *
 * Works with any transcript source (upload, Grain, Otter, Fireflies, etc.)
 * — the agent pipeline doesn't care where the transcript came from.
 *
 * Implements DataConnector interface for the data ingestion pipeline.
 */
export const transcriptConnector: DataConnector = {
  source: 'grain', // Kept as 'grain' for backward compatibility with existing DataSource type

  async pull(params: ConnectorPullParams): Promise<ConnectorResult> {
    const { organizationId, config } = params
    const lastSync = config.grain_last_sync as string | null

    const errors: ConnectorError[] = []
    const records: ConnectorRecord[] = []

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    try {
      // Fetch processed transcripts that haven't been ingested yet
      let query = supabaseAdmin
        .from('transcripts')
        .select('id, title, meeting_date, participants, summary, source, full_text, processed, created_at, organization_id, extractions')
        .eq('organization_id', organizationId)
        .eq('processed', true)
        .order('meeting_date', { ascending: false, nullsFirst: false })
        .limit(20)

      // Only fetch transcripts created/updated since last sync
      if (lastSync) {
        query = query.gt('processed_at', lastSync)
      }

      const { data: transcripts, error: fetchError } = await query

      if (fetchError) {
        errors.push({ code: 'TRANSCRIPT_FETCH_FAILED', message: fetchError.message, recoverable: true })
        return { records, errors }
      }

      if (!transcripts || transcripts.length === 0) {
        return { records, errors }
      }

      // Also fetch recent calendar events to cross-reference for meeting classification
      const { data: calendarEvents } = await supabaseAdmin
        .from('ingested_data')
        .select('payload, source_timestamp, entities')
        .eq('organization_id', organizationId)
        .eq('source', 'calendar')
        .eq('data_type', 'calendar_event')
        .gte('source_timestamp', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
        .order('source_timestamp', { ascending: false })
        .limit(100)

      for (const transcript of transcripts) {
        const meetingType = classifyMeeting(transcript, calendarEvents || [])
        const relevanceTags = buildRelevanceTags(meetingType, transcript)
        const entities = extractEntities(transcript)
        const extractions = transcript.extractions as Record<string, unknown> | null

        // Create the structured summary record for the agent pipeline
        records.push({
          source: 'grain',
          sourceId: `transcript-${transcript.id}`,
          dataType: 'transcript_summary',
          payload: {
            meeting_title: transcript.title || 'Untitled Meeting',
            meeting_type: meetingType,
            participants: transcript.participants || [],
            summary: transcript.summary || '',
            key_points: extractions?.issues
              ? (extractions.issues as Array<{ title: string }>).map(i => i.title)
              : [],
            action_items: extractions?.todos
              ? (extractions.todos as Array<{ title: string; owner?: string }>).map(t =>
                  t.owner ? `${t.owner}: ${t.title}` : t.title
                )
              : [],
            decisions: extractions?.decisions
              ? (extractions.decisions as Array<{ title: string }>).map(d => d.title)
              : [],
            rocks_mentioned: extractions?.rocks
              ? (extractions.rocks as Array<{ title: string }>).map(r => r.title)
              : [],
            transcript_id: transcript.id,
            source_system: transcript.source || 'upload',
          },
          entities,
          relevanceTags,
          sourceTimestamp: transcript.meeting_date || transcript.created_at,
        })
      }
    } catch (error: unknown) {
      const err = error as { message?: string }
      errors.push({ code: 'TRANSCRIPT_CONNECTOR_ERROR', message: err.message || 'Transcript connector failed', recoverable: true })
    }

    return {
      records,
      syncState: { grain_last_sync: new Date().toISOString() },
      errors,
    }
  },
}

/**
 * Classify meeting type based on title patterns, participants, and calendar cross-reference.
 */
function classifyMeeting(
  transcript: { title: string | null; participants: string[] | null; meeting_date: string | null },
  calendarEvents: Array<{ payload: Record<string, unknown>; source_timestamp: string | null; entities: Record<string, unknown> }>
): MeetingType {
  const title = (transcript.title || '').toLowerCase()
  const participants = transcript.participants || []

  // L10 detection by title
  if (title.includes('l10') || title.includes('level 10') || title.includes('level ten')) {
    return 'l10'
  }

  // 1:1 detection — exactly 2 participants, both internal
  if (participants.length === 2 && allInternal(participants)) {
    return '1on1'
  }

  // Try to match with a calendar event for better classification
  if (transcript.meeting_date) {
    const matchedEvent = findMatchingCalendarEvent(transcript.meeting_date, calendarEvents)
    if (matchedEvent) {
      const eventType = matchedEvent.payload.event_type as string
      if (eventType === 'l10') return 'l10'
      if (eventType === '1on1') return '1on1'
      if (eventType === 'client_meeting') {
        // Determine if sales or delivery based on title keywords
        if (title.includes('kickoff') || title.includes('sow') || title.includes('proposal') || title.includes('demo')) {
          return 'sales_call'
        }
        return 'client_delivery'
      }
    }
  }

  // Check for external participants
  const hasExternal = participants.some(p => !isInternalParticipant(p))
  if (hasExternal) {
    // Sales indicators in title
    if (title.includes('sales') || title.includes('discovery') || title.includes('pipeline') || title.includes('prospect') || title.includes('demo')) {
      return 'sales_call'
    }
    return 'client_delivery'
  }

  // Default: internal meeting with >2 people
  return 'internal'
}

/**
 * Build relevance tags based on meeting type and transcript content.
 */
function buildRelevanceTags(
  meetingType: MeetingType,
  transcript: { title: string | null; participants: string[] | null }
): string[] {
  const tags: string[] = [meetingType]

  switch (meetingType) {
    case 'l10':
      tags.push('eos', 'leadership')
      break
    case 'sales_call':
      tags.push('sales', 'prospect')
      break
    case 'client_delivery':
      tags.push('delivery')
      break
    case '1on1':
      // Tag with partner names for routing
      for (const p of (transcript.participants || [])) {
        const name = extractName(p)
        if (name) tags.push(`partner:${name.toLowerCase()}`)
      }
      break
    case 'internal':
      tags.push('team')
      break
  }

  // Extract client company name from title if present
  // Pattern: "Company Name - Meeting Topic" or "Meeting with Company Name"
  const title = transcript.title || ''
  const companyMatch = title.match(/^(.+?)\s*[-–—]\s*/)?.[1]
  if (companyMatch && companyMatch.length > 2 && companyMatch.length < 50) {
    const normalized = companyMatch.trim().toLowerCase().replace(/\s+/g, '_')
    tags.push(`client:${normalized}`)
  }

  return tags
}

/**
 * Extract entities (people, companies, action items, topics) from transcript data.
 */
function extractEntities(
  transcript: { participants: string[] | null; title: string | null; extractions: unknown }
): { people?: string[]; companies?: string[]; action_items?: string[]; topics?: string[] } {
  const people = (transcript.participants || []).map(p => extractName(p) || p)
  const companies: string[] = []
  const actionItems: string[] = []
  const topics: string[] = []

  // Extract companies from external participants' domains
  for (const p of (transcript.participants || [])) {
    const domain = extractDomain(p)
    if (domain && !CALDERA_DOMAINS.includes(domain) && !['gmail.com', 'yahoo.com', 'outlook.com'].includes(domain)) {
      companies.push(domain)
    }
  }

  // Extract action items from extractions
  const extractions = transcript.extractions as Record<string, unknown> | null
  if (extractions?.todos) {
    const todos = extractions.todos as Array<{ title: string }>
    actionItems.push(...todos.map(t => t.title))
  }

  // Extract topics from extractions
  if (extractions?.issues) {
    const issues = extractions.issues as Array<{ title: string }>
    topics.push(...issues.map(i => i.title))
  }

  return { people, companies, action_items: actionItems, topics }
}

/**
 * Check if all participants are internal (Caldera team).
 */
function allInternal(participants: string[]): boolean {
  return participants.every(p => isInternalParticipant(p))
}

function isInternalParticipant(participant: string): boolean {
  // Check email domain
  const domain = extractDomain(participant)
  if (domain && CALDERA_DOMAINS.includes(domain)) return true

  // Check known partner names
  const name = extractName(participant).toLowerCase()
  const knownPartners = ['rich', 'john', 'wade', 'rich blaalid', 'john beran', 'wade armstrong']
  return knownPartners.some(p => name.includes(p))
}

function extractName(participant: string): string {
  // If email, extract name part
  if (participant.includes('@')) {
    return participant.split('@')[0].replace(/[._]/g, ' ')
  }
  return participant.trim()
}

function extractDomain(participant: string): string | null {
  if (participant.includes('@')) {
    return participant.split('@')[1]?.toLowerCase() || null
  }
  return null
}

/**
 * Find a matching calendar event for a given meeting date (within 30 minutes).
 */
function findMatchingCalendarEvent(
  meetingDate: string,
  calendarEvents: Array<{ payload: Record<string, unknown>; source_timestamp: string | null }>
): { payload: Record<string, unknown> } | null {
  const meetingTime = new Date(meetingDate).getTime()
  const thirtyMinutes = 30 * 60 * 1000

  for (const event of calendarEvents) {
    const eventTime = event.source_timestamp ? new Date(event.source_timestamp).getTime() : 0
    if (Math.abs(eventTime - meetingTime) < thirtyMinutes) {
      return event
    }
  }

  return null
}
