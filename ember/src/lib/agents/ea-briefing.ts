import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import type { BriefingItem, AgentWorkItem, BriefingInsert } from '@/types/agents'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Zod schema for the three-tier briefing structure
const briefingSchema = z.object({
  tier1_urgent: z.array(z.object({
    title: z.string().describe('Short headline for the urgent item'),
    detail: z.string().describe('1-2 sentence explanation of why this is urgent'),
    source: z.string().describe('Where this came from: calendar, email, rock, todo, scorecard, financial'),
    action_needed: z.boolean().describe('Whether the partner needs to take action'),
  })).describe('Tier 1: Urgent items requiring immediate attention (0-3 items)'),

  tier2_business: z.array(z.object({
    title: z.string().describe('Short headline'),
    detail: z.string().describe('1-2 sentence summary'),
    source: z.string().describe('Where this came from'),
  })).describe('Tier 2: Business updates and context (3-7 items)'),

  tier3_industry: z.array(z.object({
    title: z.string().describe('Short headline'),
    detail: z.string().describe('Brief note'),
    source: z.string().describe('Where this came from'),
  })).describe('Tier 3: Industry context and lower-priority items (0-3 items)'),
})

/**
 * Generate a morning briefing for a partner.
 * Pulls EOS data, ingested data, and agent outputs, then synthesizes via Claude.
 */
export async function generateBriefing(
  partnerId: string,
  organizationId: string
): Promise<BriefingInsert> {
  const today = new Date().toISOString().split('T')[0]

  // Gather all data sources in parallel
  const [calendarEvents, recentEmails, eosData, agentOutputs, financialInsights] = await Promise.all([
    getCalendarEvents(organizationId),
    getRecentEmails(organizationId),
    getEOSData(organizationId),
    getPendingAgentOutputs(organizationId),
    getFinancialInsights(organizationId),
  ])

  // Build the user prompt with all available data
  const prompt = buildBriefingPrompt({
    calendarEvents,
    recentEmails,
    eosData,
    agentOutputs,
    financialInsights,
    today,
  })

  const model = process.env.AGENT_DEFAULT_MODEL || 'claude-sonnet-4-20250514'

  const { object } = await generateObject({
    model: anthropic(model),
    system: `You are the EA for a partner at Caldera, preparing their morning briefing.
Be direct and concise. Lead with what matters most. Use EOS terminology naturally.
Today is ${today}.`,
    prompt,
    schema: briefingSchema,
  })

  // Map agent outputs to the work queue
  const agentWorkQueue: AgentWorkItem[] = agentOutputs.map((output, idx) => ({
    id: String(idx + 1),
    agent_id: output.agent_id,
    agent_name: output.agent_name || output.agent_id,
    title: output.title,
    summary: output.summary || '',
    output_id: output.id,
    trust_zone: output.trust_zone as 1 | 2,
    status: output.status,
  }))

  // Add IDs to briefing items
  const addIds = (items: Array<{ title: string; detail: string; source: string; action_needed?: boolean }>): BriefingItem[] =>
    items.map((item, idx) => ({
      id: String(idx + 1),
      ...item,
    }))

  return {
    organization_id: organizationId,
    partner_id: partnerId,
    briefing_date: today,
    tier1_urgent: addIds(object.tier1_urgent),
    tier2_business: addIds(object.tier2_business),
    tier3_industry: addIds(object.tier3_industry),
    agent_work_queue: agentWorkQueue,
  }
}

/**
 * Save a briefing to the database and return its ID.
 */
export async function saveBriefing(briefing: BriefingInsert): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('briefings')
    .upsert(briefing, { onConflict: 'organization_id,partner_id,briefing_date' })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to save briefing:', error)
    return null
  }

  return data.id
}

/**
 * Update a briefing with Slack delivery info.
 */
export async function markBriefingDelivered(
  briefingId: string,
  slackMessageTs: string,
  slackChannelId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('briefings')
    .update({
      slack_message_ts: slackMessageTs,
      slack_channel_id: slackChannelId,
      delivered_at: new Date().toISOString(),
    })
    .eq('id', briefingId)

  if (error) console.error('Failed to mark briefing delivered:', error)
}

// ============================================
// Data fetching helpers
// ============================================

async function getCalendarEvents(organizationId: string) {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const { data } = await supabaseAdmin
    .from('ingested_data')
    .select('payload, source_timestamp')
    .eq('organization_id', organizationId)
    .eq('source', 'calendar')
    .eq('data_type', 'calendar_event')
    .gte('source_timestamp', `${todayStr}T00:00:00`)
    .order('source_timestamp', { ascending: true })
    .limit(20)

  return (data || []).map(d => d.payload as Record<string, unknown>)
}

async function getRecentEmails(organizationId: string) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabaseAdmin
    .from('ingested_data')
    .select('payload')
    .eq('organization_id', organizationId)
    .eq('source', 'gmail')
    .eq('data_type', 'email')
    .gte('ingested_at', oneDayAgo)
    .order('source_timestamp', { ascending: false })
    .limit(20)

  return (data || []).map(d => d.payload as Record<string, unknown>)
}

interface EOSData {
  overdueRocks: Array<Record<string, unknown>>
  overdueTodos: Array<Record<string, unknown>>
  offTrackMetrics: Array<Record<string, unknown>>
  openIssues: Array<Record<string, unknown>>
}

async function getEOSData(organizationId: string): Promise<EOSData> {
  const today = new Date().toISOString().split('T')[0]

  const [rocks, todos, metrics, issues] = await Promise.all([
    // Rocks that are off-track or at-risk
    supabaseAdmin
      .from('rocks')
      .select('title, status, due_date, owner_id')
      .eq('organization_id', organizationId)
      .in('status', ['off_track', 'at_risk'])
      .limit(10),

    // Overdue or due-today todos
    supabaseAdmin
      .from('todos')
      .select('title, due_date, owner_id, completed')
      .eq('organization_id', organizationId)
      .eq('completed', false)
      .lte('due_date', today)
      .limit(10),

    // Scorecard metrics - get recent entries to check off-track
    supabaseAdmin
      .from('scorecard_metrics')
      .select('name, target, unit, goal_direction, owner_id')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .limit(15),

    // Open issues (top priority)
    supabaseAdmin
      .from('issues')
      .select('title, priority, status, owner_id')
      .eq('organization_id', organizationId)
      .in('status', ['open', 'identified'])
      .order('priority', { ascending: false })
      .limit(5),
  ])

  return {
    overdueRocks: (rocks.data || []) as Array<Record<string, unknown>>,
    overdueTodos: (todos.data || []) as Array<Record<string, unknown>>,
    offTrackMetrics: (metrics.data || []) as Array<Record<string, unknown>>,
    openIssues: (issues.data || []) as Array<Record<string, unknown>>,
  }
}

async function getPendingAgentOutputs(organizationId: string) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabaseAdmin
    .from('agent_outputs')
    .select('id, agent_id, output_type, title, summary, trust_zone, status, content')
    .eq('organization_id', organizationId)
    .in('status', ['completed', 'pending_review'])
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(10)

  return (data || []).map(d => ({
    ...d,
    agent_name: d.agent_id === 'financial-strategist' ? 'Financial Strategist' : d.agent_id,
  }))
}

async function getFinancialInsights(organizationId: string) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Get the most recent Financial Strategist analysis
  const { data } = await supabaseAdmin
    .from('agent_outputs')
    .select('title, summary, content')
    .eq('organization_id', organizationId)
    .eq('agent_id', 'financial-strategist')
    .eq('output_type', 'analysis')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!data || data.length === 0) return null

  return data[0].content as Record<string, unknown>
}

// ============================================
// Prompt builder
// ============================================

function buildBriefingPrompt(data: {
  calendarEvents: Array<Record<string, unknown>>
  recentEmails: Array<Record<string, unknown>>
  eosData: EOSData
  agentOutputs: Array<Record<string, unknown>>
  financialInsights: Record<string, unknown> | null
  today: string
}): string {
  const sections: string[] = []

  // Calendar
  if (data.calendarEvents.length > 0) {
    const events = data.calendarEvents.map(e =>
      `- ${e.title} (${e.start}) [${e.event_type}] ${(e.attendees as string[] || []).length} attendees`
    ).join('\n')
    sections.push(`## Today's Calendar\n${events}`)
  } else {
    sections.push('## Today\'s Calendar\nNo events scheduled.')
  }

  // Emails
  if (data.recentEmails.length > 0) {
    const emails = data.recentEmails
      .filter(e => e.priority === 'high' || e.action_needed)
      .slice(0, 5)
      .map(e => `- [${e.category}/${e.priority}] ${e.subject} — from ${e.from}`)
      .join('\n')
    sections.push(`## Important Emails (last 24h)\n${emails || 'No high-priority emails.'}`)
  }

  // EOS: Off-track Rocks
  if (data.eosData.overdueRocks.length > 0) {
    const rocks = data.eosData.overdueRocks
      .map(r => `- ${r.title} [${r.status}] due ${r.due_date || 'no date'}`)
      .join('\n')
    sections.push(`## Rocks Needing Attention\n${rocks}`)
  }

  // EOS: Overdue To-dos
  if (data.eosData.overdueTodos.length > 0) {
    const todos = data.eosData.overdueTodos
      .map(t => `- ${t.title} (due ${t.due_date})`)
      .join('\n')
    sections.push(`## Overdue To-dos\n${todos}`)
  }

  // EOS: Open Issues
  if (data.eosData.openIssues.length > 0) {
    const issues = data.eosData.openIssues
      .map(i => `- [P${i.priority}] ${i.title} [${i.status}]`)
      .join('\n')
    sections.push(`## Open Issues for IDS\n${issues}`)
  }

  // Financial insights from Financial Strategist
  if (data.financialInsights) {
    const fi = data.financialInsights
    const fiSections: string[] = []

    if (fi.summary) fiSections.push(`Summary: ${fi.summary}`)

    const arAlerts = fi.ar_aging_alerts as Array<{ client_name: string; days_outstanding: number; amount_due: number }> | undefined
    if (arAlerts && arAlerts.length > 0) {
      fiSections.push('AR Alerts:\n' + arAlerts.map(a =>
        `- ${a.client_name}: $${a.amount_due.toLocaleString()} — ${a.days_outstanding} days outstanding`
      ).join('\n'))
    }

    const concentration = fi.concentration_risk as { top_client_name: string; top_client_pct: number; is_above_threshold: boolean } | undefined
    if (concentration?.is_above_threshold) {
      fiSections.push(`Concentration Risk: ${concentration.top_client_name} at ${concentration.top_client_pct}% of revenue`)
    }

    const cashFlow = fi.cash_flow_assessment as { net_position: string; note: string } | undefined
    if (cashFlow) {
      fiSections.push(`Cash Flow: ${cashFlow.net_position} — ${cashFlow.note}`)
    }

    sections.push(`## Financial Insights (Financial Strategist)\n${fiSections.join('\n')}`)
  }

  // Agent outputs
  if (data.agentOutputs.length > 0) {
    const outputs = data.agentOutputs
      .map(o => `- [${o.agent_id}] ${o.title}: ${o.summary || 'No summary'}`)
      .join('\n')
    sections.push(`## Agent Insights (Overnight)\n${outputs}`)
  }

  return `Generate the morning briefing for ${data.today}. Synthesize the following data into a three-tier format.

${sections.join('\n\n')}

Instructions:
- Tier 1 (Urgent): Items needing action TODAY. Include overdue EOS items, critical emails, meetings with client attendees requiring prep, financial threshold breaches (AR > 45 days, margin < 30%, concentration > 60%).
- Tier 2 (Business): Calendar overview, EOS status updates, financial highlights, agent insights, important but not urgent emails.
- Tier 3 (Industry): Lower-priority items, industry context, informational items.
- Financial insights from the Financial Strategist should be prominently featured — AR alerts and threshold breaches go in Tier 1, cash flow and margin analysis in Tier 2.
- Be specific — include names, dates, and numbers. Don't be vague.`
}
