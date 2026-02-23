import { Client } from '@hubspot/api-client'
import type { DataConnector, ConnectorPullParams, ConnectorResult, ConnectorRecord, ConnectorError } from './types'

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID!
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET!

/**
 * HubSpot connector that pulls deals, contacts, and companies.
 * Implements DataConnector interface for the data ingestion pipeline.
 */
export const hubspotConnector: DataConnector = {
  source: 'hubspot',

  async pull(params: ConnectorPullParams): Promise<ConnectorResult> {
    const { config } = params
    const refreshToken = config.hubspot_refresh_token as string

    if (!refreshToken) {
      return { records: [], errors: [{ code: 'NO_TOKEN', message: 'No HubSpot credentials', recoverable: false }] }
    }

    const errors: ConnectorError[] = []

    // Refresh the access token
    let client: Client
    let newRefreshToken: string | undefined
    try {
      const result = await refreshAccessToken(refreshToken)
      client = result.client
      newRefreshToken = result.newRefreshToken
    } catch (error: unknown) {
      const err = error as { message?: string }
      return { records: [], errors: [{ code: 'TOKEN_REFRESH_FAILED', message: err.message || 'HubSpot token refresh failed', recoverable: true }] }
    }

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

    return {
      records,
      syncState: newRefreshToken ? { hubspot_refresh_token: newRefreshToken } : undefined,
      errors,
    }
  },
}

async function refreshAccessToken(refreshToken: string): Promise<{ client: Client; newRefreshToken?: string }> {
  const client = new Client()
  const tokenResponse = await client.oauth.tokensApi.create(
    'refresh_token',
    undefined,
    undefined,
    HUBSPOT_CLIENT_ID,
    HUBSPOT_CLIENT_SECRET,
    refreshToken
  )

  client.setAccessToken(tokenResponse.accessToken)

  return {
    client,
    newRefreshToken: tokenResponse.refreshToken !== refreshToken ? tokenResponse.refreshToken : undefined,
  }
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
