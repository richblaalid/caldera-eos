import { Client } from '@hubspot/api-client'
import type { DataConnector, ConnectorPullParams, ConnectorResult, ConnectorRecord, ConnectorError } from './types'

/**
 * HubSpot connector using a Private App access token.
 * Pulls deals, contacts, and companies for the data ingestion pipeline.
 *
 * Setup: Create a Private App in HubSpot with these scopes:
 *   - crm.objects.deals.read
 *   - crm.objects.contacts.read
 *   - crm.objects.companies.read
 *   - crm.objects.owners.read
 *
 * Set HUBSPOT_ACCESS_TOKEN in your environment.
 */
export const hubspotConnector: DataConnector = {
  source: 'hubspot',

  async pull(params: ConnectorPullParams): Promise<ConnectorResult> {
    const accessToken = process.env.HUBSPOT_ACCESS_TOKEN
    if (!accessToken) {
      return { records: [], errors: [{ code: 'NO_TOKEN', message: 'HUBSPOT_ACCESS_TOKEN not configured', recoverable: false }] }
    }

    // Ignore params.config — token comes from env, not per-partner DB
    void params

    const client = new Client({ accessToken })
    const errors: ConnectorError[] = []
    const records: ConnectorRecord[] = []

    // Pull active deals
    try {
      const deals = await fetchDeals(client)
      for (const deal of deals) {
        records.push(normalizeDeal(deal))
      }
    } catch (error: unknown) {
      const err = error as { message?: string }
      errors.push({ code: 'DEALS_FETCH_FAILED', message: err.message || 'Deals fetch failed', recoverable: true })
    }

    // Pull companies
    try {
      const companies = await fetchCompanies(client)
      for (const company of companies) {
        records.push(normalizeCompany(company))
      }
    } catch (error: unknown) {
      const err = error as { message?: string }
      errors.push({ code: 'COMPANIES_FETCH_FAILED', message: err.message || 'Companies fetch failed', recoverable: true })
    }

    // Pull contacts
    try {
      const contacts = await fetchContacts(client)
      for (const contact of contacts) {
        records.push(normalizeContact(contact))
      }
    } catch (error: unknown) {
      const err = error as { message?: string }
      errors.push({ code: 'CONTACTS_FETCH_FAILED', message: err.message || 'Contacts fetch failed', recoverable: true })
    }

    // Pull recent engagements (calls, emails, meetings — last 7 days)
    try {
      const engagements = await fetchRecentEngagements(client)
      for (const engagement of engagements) {
        records.push(engagement)
      }
    } catch (error: unknown) {
      const err = error as { message?: string }
      errors.push({ code: 'ENGAGEMENTS_FETCH_FAILED', message: err.message || 'Engagements fetch failed', recoverable: true })
    }

    return { records, errors }
  },
}

const DEAL_PROPERTIES = [
  'dealname', 'amount', 'closedate', 'dealstage', 'pipeline',
  'hubspot_owner_id', 'createdate', 'hs_lastmodifieddate',
  'hs_deal_stage_probability', 'notes_last_updated',
]

async function fetchDeals(client: Client) {
  const response = await client.crm.deals.basicApi.getPage(
    100,
    undefined,
    DEAL_PROPERTIES,
  )
  return response.results
}

const COMPANY_PROPERTIES = [
  'name', 'domain', 'industry', 'numberofemployees',
  'annualrevenue', 'hubspot_owner_id', 'createdate',
]

async function fetchCompanies(client: Client) {
  const response = await client.crm.companies.basicApi.getPage(
    100,
    undefined,
    COMPANY_PROPERTIES,
  )
  return response.results
}

const CONTACT_PROPERTIES = [
  'firstname', 'lastname', 'email', 'company',
  'jobtitle', 'hubspot_owner_id', 'createdate', 'lastmodifieddate',
]

async function fetchContacts(client: Client) {
  const response = await client.crm.contacts.basicApi.getPage(
    100,
    undefined,
    CONTACT_PROPERTIES,
  )
  return response.results
}

/**
 * Fetch recent engagements (calls, emails, meetings) from the last 7 days.
 * Uses the CRM search API with date filtering.
 * Requires scopes: crm.objects.calls.read, crm.objects.emails.read, crm.objects.meetings.read
 */
async function fetchRecentEngagements(client: Client): Promise<ConnectorRecord[]> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const records: ConnectorRecord[] = []

  const engagementTypes = [
    {
      objectType: 'calls',
      properties: ['hs_timestamp', 'hubspot_owner_id', 'hs_call_title', 'hs_call_duration', 'hs_call_direction'],
      normalize: normalizeCall,
    },
    {
      objectType: 'emails',
      properties: ['hs_timestamp', 'hubspot_owner_id', 'hs_email_subject', 'hs_email_direction'],
      normalize: normalizeEmailEngagement,
    },
    {
      objectType: 'meetings',
      properties: ['hs_timestamp', 'hubspot_owner_id', 'hs_meeting_title', 'hs_meeting_start_time', 'hs_meeting_end_time'],
      normalize: normalizeMeeting,
    },
  ] as const

  for (const engType of engagementTypes) {
    try {
      const response = await client.apiRequest({
        method: 'POST',
        path: `/crm/v3/objects/${engType.objectType}/search`,
        body: {
          filterGroups: [{
            filters: [{
              propertyName: 'hs_timestamp',
              operator: 'GTE',
              value: sevenDaysAgo.toString(),
            }],
          }],
          sorts: [{ propertyName: 'hs_timestamp', direction: 'DESCENDING' }],
          properties: engType.properties as unknown as string[],
          limit: 100,
          after: 0,
        },
      })
      const data = await response.json() as { results?: Array<{ id: string; properties: Record<string, string | null> }> }
      for (const result of data.results || []) {
        records.push(engType.normalize(result))
      }
    } catch {
      // Individual engagement type failure is non-fatal — may not have scope
    }
  }

  return records
}

function normalizeCall(call: { id: string; properties: Record<string, string | null> }): ConnectorRecord {
  const props = call.properties
  return {
    source: 'hubspot',
    sourceId: `call-${call.id}`,
    dataType: 'engagement',
    payload: {
      engagement_type: 'call',
      title: props.hs_call_title,
      direction: props.hs_call_direction,
      duration_ms: props.hs_call_duration ? parseInt(props.hs_call_duration) : null,
      owner_id: props.hubspot_owner_id,
      timestamp: props.hs_timestamp,
    },
    entities: { topics: ['call', 'outreach'] },
    relevanceTags: ['sales', 'engagement', 'call'],
    sourceTimestamp: props.hs_timestamp || null,
  }
}

function normalizeEmailEngagement(email: { id: string; properties: Record<string, string | null> }): ConnectorRecord {
  const props = email.properties
  return {
    source: 'hubspot',
    sourceId: `hs-email-${email.id}`,
    dataType: 'engagement',
    payload: {
      engagement_type: 'email',
      subject: props.hs_email_subject,
      direction: props.hs_email_direction,
      owner_id: props.hubspot_owner_id,
      timestamp: props.hs_timestamp,
    },
    entities: { topics: ['email', 'outreach'] },
    relevanceTags: ['sales', 'engagement', 'email'],
    sourceTimestamp: props.hs_timestamp || null,
  }
}

function normalizeMeeting(meeting: { id: string; properties: Record<string, string | null> }): ConnectorRecord {
  const props = meeting.properties
  return {
    source: 'hubspot',
    sourceId: `meeting-${meeting.id}`,
    dataType: 'engagement',
    payload: {
      engagement_type: 'meeting',
      title: props.hs_meeting_title,
      start_time: props.hs_meeting_start_time,
      end_time: props.hs_meeting_end_time,
      owner_id: props.hubspot_owner_id,
      timestamp: props.hs_timestamp,
    },
    entities: { topics: ['meeting', 'outreach'] },
    relevanceTags: ['sales', 'engagement', 'meeting'],
    sourceTimestamp: props.hs_timestamp || null,
  }
}

/** Calculate days between two dates */
function daysBetween(date1: Date, date2: Date): number {
  return Math.floor((date1.getTime() - date2.getTime()) / (24 * 60 * 60 * 1000))
}

function normalizeDeal(deal: { id: string; properties: Record<string, string | null> }): ConnectorRecord {
  const props = deal.properties
  const amount = props.amount ? parseFloat(props.amount) : 0
  const closeDate = props.closedate || null
  const now = new Date()

  // Calculate deal velocity (days since creation)
  const createDate = props.createdate ? new Date(props.createdate) : now
  const dealAge = daysBetween(now, createDate)

  // Calculate days until close
  const daysUntilClose = closeDate ? daysBetween(new Date(closeDate), now) : null

  // Determine deal status
  const stage = props.dealstage || 'unknown'
  const isClosingSoon = daysUntilClose !== null && daysUntilClose >= 0 && daysUntilClose <= 7
  const isOverdue = daysUntilClose !== null && daysUntilClose < 0
  const probability = props.hs_deal_stage_probability ? parseFloat(props.hs_deal_stage_probability) : null

  const tags = ['sales', 'pipeline']
  if (isClosingSoon) tags.push('closing_soon')
  if (isOverdue) tags.push('overdue_close')
  if (amount >= 50000) tags.push('high_value')

  return {
    source: 'hubspot',
    sourceId: `deal-${deal.id}`,
    dataType: 'deal',
    payload: {
      deal_id: deal.id,
      deal_name: props.dealname,
      amount,
      close_date: closeDate,
      stage,
      pipeline: props.pipeline || 'default',
      owner_id: props.hubspot_owner_id,
      probability,
      deal_age_days: dealAge,
      days_until_close: daysUntilClose,
      is_closing_soon: isClosingSoon,
      is_overdue: isOverdue,
      last_modified: props.hs_lastmodifieddate,
    },
    entities: {
      companies: props.dealname ? [props.dealname] : [],
      topics: ['sales', 'deals', stage],
    },
    relevanceTags: tags,
    sourceTimestamp: props.hs_lastmodifieddate || props.createdate || null,
  }
}

function normalizeCompany(company: { id: string; properties: Record<string, string | null> }): ConnectorRecord {
  const props = company.properties
  const revenue = props.annualrevenue ? parseFloat(props.annualrevenue) : null

  return {
    source: 'hubspot',
    sourceId: `company-${company.id}`,
    dataType: 'company',
    payload: {
      company_id: company.id,
      name: props.name,
      domain: props.domain,
      industry: props.industry,
      employee_count: props.numberofemployees ? parseInt(props.numberofemployees) : null,
      annual_revenue: revenue,
      owner_id: props.hubspot_owner_id,
    },
    entities: {
      companies: props.name ? [props.name] : [],
      topics: ['company', props.industry || 'unknown'].filter(Boolean),
    },
    relevanceTags: ['sales', 'company'],
    sourceTimestamp: props.createdate || null,
  }
}

function normalizeContact(contact: { id: string; properties: Record<string, string | null> }): ConnectorRecord {
  const props = contact.properties
  const fullName = [props.firstname, props.lastname].filter(Boolean).join(' ')

  return {
    source: 'hubspot',
    sourceId: `contact-${contact.id}`,
    dataType: 'contact',
    payload: {
      contact_id: contact.id,
      name: fullName || 'Unknown',
      email: props.email,
      company: props.company,
      job_title: props.jobtitle,
      owner_id: props.hubspot_owner_id,
    },
    entities: {
      people: fullName ? [fullName] : [],
      companies: props.company ? [props.company] : [],
      topics: ['contact', 'sales'],
    },
    relevanceTags: ['sales', 'contact'],
    sourceTimestamp: props.lastmodifieddate || props.createdate || null,
  }
}
