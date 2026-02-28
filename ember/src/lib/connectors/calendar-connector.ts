import { google, type calendar_v3 } from 'googleapis'
import { createAuthenticatedGoogleClient } from './google-auth'
import type { DataConnector, ConnectorPullParams, ConnectorResult, ConnectorRecord, ConnectorError } from './types'
import type { CalendarEventType, IngestedEntities } from '@/types/agents'

/**
 * Calendar connector that polls Google Calendar for upcoming events,
 * classifies event types, and extracts attendee information.
 */
export const calendarConnector: DataConnector = {
  source: 'calendar',

  async pull(params: ConnectorPullParams): Promise<ConnectorResult> {
    const { config } = params
    const refreshToken = config.google_refresh_token as string

    if (!refreshToken) {
      return { records: [], errors: [{ code: 'NO_TOKEN', message: 'No Google refresh token', recoverable: false }] }
    }

    const auth = createAuthenticatedGoogleClient(refreshToken)
    const calendar = google.calendar({ version: 'v3', auth })

    const errors: ConnectorError[] = []
    const records: ConnectorRecord[] = []

    try {
      const now = new Date()
      const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: sevenDaysOut.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 100,
      })

      const events = response.data.items || []

      for (const event of events) {
        if (!event.id) continue

        const attendees = (event.attendees || []).map(a => a.email || '').filter(Boolean)
        const eventType = classifyEventType(event)
        const entities = extractEntities(event)

        records.push({
          source: 'calendar',
          sourceId: event.id,
          dataType: 'calendar_event',
          payload: {
            title: event.summary || 'Untitled',
            description: event.description || '',
            start: event.start?.dateTime || event.start?.date || '',
            end: event.end?.dateTime || event.end?.date || '',
            location: event.location || '',
            attendees,
            event_type: eventType,
            organizer: event.organizer?.email || '',
            status: event.status || 'confirmed',
            html_link: event.htmlLink || '',
            conference_link: extractConferenceLink(event),
          },
          entities,
          relevanceTags: [eventType, isToday(event) ? 'today' : 'upcoming'],
          sourceTimestamp: event.start?.dateTime || event.start?.date || null,
        })
      }
    } catch (error: unknown) {
      const err = error as { message?: string }
      errors.push({ code: 'CALENDAR_FETCH_FAILED', message: err.message || 'Calendar fetch failed', recoverable: true })
    }

    return { records, errors }
  },
}

/**
 * Classify event type based on title and attendees.
 */
function classifyEventType(event: calendar_v3.Schema$Event): CalendarEventType {
  const title = (event.summary || '').toLowerCase()
  const attendees = event.attendees || []

  // L10 detection
  if (title.includes('l10') || title.includes('level 10')) {
    return 'l10'
  }

  // 1-on-1 detection
  if (title.includes('1:1') || title.includes('1on1') || title.includes('one on one') || title.includes('1-on-1')) {
    return '1on1'
  }

  // Check if all attendees are internal (same domain)
  const domains = attendees.map(a => (a.email || '').split('@')[1]).filter(Boolean)
  const uniqueDomains = new Set(domains)
  const calderaDomains = ['withcaldera.com', 'bko.group']
  const allInternal = domains.length > 0 && [...uniqueDomains].every(d => calderaDomains.includes(d))

  if (allInternal) {
    return 'internal'
  }

  // External attendees = client meeting
  if (attendees.length > 0 && !allInternal) {
    return 'client_meeting'
  }

  return 'other'
}

/**
 * Extract entities (people and companies) from event data.
 */
function extractEntities(event: calendar_v3.Schema$Event): IngestedEntities {
  const attendees = event.attendees || []
  const people: string[] = []
  const companies: string[] = []
  const domains = new Set<string>()

  for (const attendee of attendees) {
    if (attendee.displayName) {
      people.push(attendee.displayName)
    } else if (attendee.email) {
      people.push(attendee.email)
    }

    if (attendee.email) {
      const domain = attendee.email.split('@')[1]
      if (domain && !['gmail.com', 'withcaldera.com', 'bko.group', 'google.com'].includes(domain)) {
        domains.add(domain)
      }
    }
  }

  companies.push(...domains)

  return { people, companies }
}

/**
 * Extract video conference link from event.
 */
function extractConferenceLink(event: calendar_v3.Schema$Event): string {
  // Check conferenceData first
  if (event.conferenceData?.entryPoints) {
    const videoEntry = event.conferenceData.entryPoints.find(e => e.entryPointType === 'video')
    if (videoEntry?.uri) return videoEntry.uri
  }

  // Check hangoutLink
  if (event.hangoutLink) return event.hangoutLink

  return ''
}

/**
 * Check if an event is happening today.
 */
function isToday(event: calendar_v3.Schema$Event): boolean {
  const eventDate = event.start?.dateTime || event.start?.date
  if (!eventDate) return false

  const today = new Date()
  const eventDay = new Date(eventDate)
  return today.toDateString() === eventDay.toDateString()
}
