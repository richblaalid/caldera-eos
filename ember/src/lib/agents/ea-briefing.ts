import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import type { BriefingItem, AgentWorkItem, BriefingInsert } from '@/types/agents'
import { getSmartLookback, getTranscriptLabel } from './lookback'

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
  const [calendarEvents, recentEmails, eosData, agentOutputs, financialInsights, pipelineData, bdInsights, transcriptHighlights, ownerNames] = await Promise.all([
    getCalendarEvents(organizationId),
    getRecentEmails(organizationId),
    getEOSData(organizationId),
    getPendingAgentOutputs(organizationId),
    getFinancialInsights(organizationId),
    getPipelineData(organizationId),
    getBDStrategistInsights(organizationId),
    getTranscriptHighlights(organizationId),
    getOwnerNames(organizationId),
  ])

  // Build the user prompt with all available data
  const prompt = buildBriefingPrompt({
    calendarEvents,
    recentEmails,
    eosData,
    agentOutputs,
    financialInsights,
    pipelineData,
    bdInsights,
    transcriptHighlights,
    ownerNames,
    today,
  })

  const model = process.env.AGENT_DEFAULT_MODEL || 'claude-sonnet-4-20250514'

  const systemPrompt = buildEASystemPrompt(today)

  const { object } = await generateObject({
    model: anthropic(model),
    system: systemPrompt,
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
// EA System Prompt
// ============================================

function buildEASystemPrompt(today: string): string {
  return `You are Ember, the Executive Assistant for Caldera's leadership team. You prepare the morning briefing — the first thing a partner sees each day.

## Your Identity
Ember is the "fourth partner" at Caldera. You're direct, opinionated, and protective of the partner's time and focus. You earn your seat at the table through intelligence, not just administration. You speak in EOS terminology naturally.

## Caldera Context
- 14-person software services company (~$2.5M annual revenue)
- Three partners: Rich (CEO/CFO/COO/Integrator), John (Sales), Wade (Engineering/Solutions)
- CRITICAL: 73% revenue from a single anchor client — diversification is existential
- Transforming from T&M billing to value-based fixed-fee engagements
- Repositioning from "dev services" to "AI-powered product consultancy"
- Running EOS (Traction) — L10 meetings weekly, quarterly Rocks, weekly Scorecard, IDS for Issues

## Rich's Role (Primary User)
Rich wears the most hats: CEO, CFO, COO, EOS Integrator. He needs to:
- Monitor financial health (cash flow, margins, AR)
- Track EOS execution across all three partners
- Prepare for L10 and client meetings
- Push business development while protecting the anchor client
- Make strategic decisions with limited time

## Briefing Principles
1. **Lead with what will cost money or reputation if ignored today.** Not what's interesting — what's urgent.
2. **Be specific.** Never say "several items" or "some metrics." Use exact numbers, names, dates, percentages.
3. **Include trend direction.** Is it getting better or worse? Use ↑↓→ indicators.
4. **Name the owner.** Every EOS item has an owner — say who.
5. **Connect the dots.** If a stalled Rock relates to a Scorecard miss, say so.
6. **Financial alerts get priority.** AR aging, margin erosion, cash flow runway — these go in Tier 1.
7. **EOS completion rates matter.** 90% To-do completion, 80% Rock completion are the targets. Flag when below.
8. **Be concise.** Each item should be 1-2 sentences max. The partner should scan the briefing in 60 seconds.

Today is ${today}.`
}

// ============================================
// Data fetching helpers
// ============================================

/** Resolve owner UUIDs to names for readable briefing content */
async function getOwnerNames(organizationId: string): Promise<Map<string, string>> {
  const { data } = await supabaseAdmin
    .from('organization_members')
    .select('user_id, profiles(name)')
    .eq('organization_id', organizationId)

  const map = new Map<string, string>()
  for (const row of data || []) {
    // Supabase returns joined relation as object (single) or array depending on FK
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    const name = (profile as { name: string | null } | undefined)?.name
    if (name) map.set(row.user_id, name.split(' ')[0]) // First name only
  }
  return map
}

async function getCalendarEvents(organizationId: string) {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const weekOut = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data } = await supabaseAdmin
    .from('ingested_data')
    .select('payload, source_timestamp')
    .eq('organization_id', organizationId)
    .eq('source', 'calendar')
    .eq('data_type', 'calendar_event')
    .gte('source_timestamp', `${todayStr}T00:00:00`)
    .lte('source_timestamp', `${weekOut}T23:59:59`)
    .order('source_timestamp', { ascending: true })
    .limit(30)

  // Tag each event as today vs. upcoming
  return (data || []).map(d => {
    const payload = d.payload as Record<string, unknown>
    const eventDate = (d.source_timestamp || '').split('T')[0]
    return { ...payload, _is_today: eventDate === todayStr, _date: eventDate }
  })
}

async function getRecentEmails(organizationId: string) {
  const oneDayAgo = getSmartLookback(24)

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
  rocks: Array<Record<string, unknown>>
  overdueTodos: Array<Record<string, unknown>>
  upcomingTodos: Array<Record<string, unknown>>
  scorecardTrends: Array<Record<string, unknown>>
  openIssues: Array<Record<string, unknown>>
  todoCompletionRate: { completed: number; total: number } | null
}

async function getEOSData(organizationId: string): Promise<EOSData> {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const fourWeeksAgo = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [rocks, overdueTodos, upcomingTodos, metrics, entries, issues, completedTodos, totalTodos] = await Promise.all([
    // All active rocks (not just off-track) with milestones for progress tracking
    supabaseAdmin
      .from('rocks')
      .select('title, status, due_date, owner_id, milestones, quarter')
      .eq('organization_id', organizationId)
      .in('status', ['on_track', 'off_track', 'at_risk'])
      .limit(15),

    // Overdue or due-today todos
    supabaseAdmin
      .from('todos')
      .select('title, due_date, owner_id')
      .eq('organization_id', organizationId)
      .eq('completed', false)
      .lte('due_date', todayStr)
      .limit(10),

    // Upcoming todos (next 7 days)
    supabaseAdmin
      .from('todos')
      .select('title, due_date, owner_id')
      .eq('organization_id', organizationId)
      .eq('completed', false)
      .gt('due_date', todayStr)
      .lte('due_date', nextWeek)
      .limit(10),

    // Active scorecard metrics
    supabaseAdmin
      .from('scorecard_metrics')
      .select('id, name, target, unit, goal_direction, owner_id')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .limit(15),

    // Last 4 weeks of scorecard entries for trend analysis
    supabaseAdmin
      .from('scorecard_entries')
      .select('metric_id, value, week_of')
      .eq('organization_id', organizationId)
      .gte('week_of', fourWeeksAgo)
      .order('week_of', { ascending: true }),

    // Open issues (top priority)
    supabaseAdmin
      .from('issues')
      .select('title, priority, status, owner_id, created_at')
      .eq('organization_id', organizationId)
      .in('status', ['open', 'identified'])
      .order('priority', { ascending: false })
      .limit(7),

    // Todo completion rate (last 2 weeks)
    supabaseAdmin
      .from('todos')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('completed', true)
      .gte('due_date', twoWeeksAgo),

    supabaseAdmin
      .from('todos')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('due_date', twoWeeksAgo),
  ])

  // Build scorecard trends: for each metric, compute last 4 values and consecutive misses
  const metricsData = metrics.data || []
  const entriesData = entries.data || []
  const scorecardTrends = metricsData.map(metric => {
    const metricEntries = entriesData
      .filter(e => e.metric_id === metric.id)
      .sort((a, b) => (a.week_of as string).localeCompare(b.week_of as string))

    const values = metricEntries.map(e => e.value as number)
    const isAbove = metric.goal_direction === 'above'
    const consecutiveMisses = values.reduceRight((acc, val) => {
      if (acc.done) return acc
      const missed = isAbove ? val < (metric.target as number) : val > (metric.target as number)
      if (missed) return { count: acc.count + 1, done: false }
      return { ...acc, done: true }
    }, { count: 0, done: false }).count

    const latestValue = values.length > 0 ? values[values.length - 1] : null
    const previousValue = values.length > 1 ? values[values.length - 2] : null
    const trend = latestValue !== null && previousValue !== null
      ? latestValue > previousValue ? '↑' : latestValue < previousValue ? '↓' : '→'
      : null

    return {
      ...metric,
      latest_value: latestValue,
      previous_value: previousValue,
      trend,
      consecutive_misses: consecutiveMisses,
      values,
    }
  })

  return {
    rocks: (rocks.data || []) as Array<Record<string, unknown>>,
    overdueTodos: (overdueTodos.data || []) as Array<Record<string, unknown>>,
    upcomingTodos: (upcomingTodos.data || []) as Array<Record<string, unknown>>,
    scorecardTrends: scorecardTrends as Array<Record<string, unknown>>,
    openIssues: (issues.data || []) as Array<Record<string, unknown>>,
    todoCompletionRate: totalTodos.count
      ? { completed: completedTodos.count || 0, total: totalTodos.count }
      : null,
  }
}

async function getPendingAgentOutputs(organizationId: string) {
  const oneDayAgo = getSmartLookback(24)

  const { data } = await supabaseAdmin
    .from('agent_outputs')
    .select('id, agent_id, output_type, title, summary, trust_zone, status, content')
    .eq('organization_id', organizationId)
    .in('status', ['completed', 'pending_review'])
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(10)

  const agentNames: Record<string, string> = {
    'financial-strategist': 'Financial Strategist',
    'bd-strategist': 'BD Strategist',
    'ea': 'Executive Assistant',
  }
  return (data || []).map(d => ({
    ...d,
    agent_name: agentNames[d.agent_id] || d.agent_id,
  }))
}

async function getFinancialInsights(organizationId: string) {
  const oneDayAgo = getSmartLookback(24)

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

async function getBDStrategistInsights(organizationId: string) {
  const oneDayAgo = getSmartLookback(24)

  const { data } = await supabaseAdmin
    .from('agent_outputs')
    .select('title, summary, content')
    .eq('organization_id', organizationId)
    .eq('agent_id', 'bd-strategist')
    .eq('output_type', 'analysis')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!data || data.length === 0) return null

  return data[0].content as Record<string, unknown>
}

interface PipelineData {
  deals: Array<Record<string, unknown>>
  totalPipelineValue: number
  closingSoon: Array<Record<string, unknown>>
  overdueDeals: Array<Record<string, unknown>>
}

async function getPipelineData(organizationId: string): Promise<PipelineData | null> {
  const { data } = await supabaseAdmin
    .from('ingested_data')
    .select('payload')
    .eq('organization_id', organizationId)
    .eq('source', 'hubspot')
    .eq('data_type', 'deal')
    .order('source_timestamp', { ascending: false })
    .limit(100)

  if (!data || data.length === 0) return null

  const deals = data.map(d => d.payload as Record<string, unknown>)
  const totalPipelineValue = deals.reduce((sum, d) => sum + ((d.amount as number) || 0), 0)
  const closingSoon = deals.filter(d => d.is_closing_soon)
  const overdueDeals = deals.filter(d => d.is_overdue)

  return { deals, totalPipelineValue, closingSoon, overdueDeals }
}

interface TranscriptHighlight {
  meeting_title: string
  meeting_type: string
  summary: string
  key_points: string[]
  action_items: string[]
  decisions: string[]
  source_timestamp: string
}

async function getTranscriptHighlights(organizationId: string): Promise<TranscriptHighlight[]> {
  const twoDaysAgo = getSmartLookback(48)

  const { data } = await supabaseAdmin
    .from('ingested_data')
    .select('payload, source_timestamp')
    .eq('organization_id', organizationId)
    .eq('source', 'grain')
    .eq('data_type', 'transcript_summary')
    .gte('source_timestamp', twoDaysAgo)
    .order('source_timestamp', { ascending: false })
    .limit(5)

  if (!data || data.length === 0) return []

  return data.map(d => {
    const p = d.payload as Record<string, unknown>
    return {
      meeting_title: (p.meeting_title as string) || 'Untitled',
      meeting_type: (p.meeting_type as string) || 'unknown',
      summary: (p.summary as string) || '',
      key_points: (p.key_points as string[]) || [],
      action_items: (p.action_items as string[]) || [],
      decisions: (p.decisions as string[]) || [],
      source_timestamp: d.source_timestamp || '',
    }
  })
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
  pipelineData: PipelineData | null
  bdInsights: Record<string, unknown> | null
  transcriptHighlights: TranscriptHighlight[]
  ownerNames: Map<string, string>
  today: string
}): string {
  const sections: string[] = []
  const ownerName = (id: unknown) => (id && data.ownerNames.get(id as string)) || 'Unassigned'

  // Calendar — split today vs. upcoming
  const todayEvents = data.calendarEvents.filter(e => e._is_today)
  const upcomingEvents = data.calendarEvents.filter(e => !e._is_today)

  if (todayEvents.length > 0) {
    const events = todayEvents.map(e => {
      const time = typeof e.start === 'string' ? e.start.split('T')[1]?.substring(0, 5) : ''
      const attendees = (e.attendees as string[] || [])
      return `- ${time ? time + ' ' : ''}${e.title} [${e.event_type}] — ${attendees.join(', ') || 'no attendees'}${e.location ? ` (${e.location})` : ''}`
    }).join('\n')
    sections.push(`## Today's Calendar (${todayEvents.length} events)\n${events}`)
  } else {
    sections.push('## Today\'s Calendar\nNo events scheduled today.')
  }

  if (upcomingEvents.length > 0) {
    const events = upcomingEvents.slice(0, 10).map(e => {
      const date = e._date as string
      return `- ${date} ${e.title} [${e.event_type}]`
    }).join('\n')
    sections.push(`## Upcoming This Week (${upcomingEvents.length} events)\n${events}`)
  }

  // Emails
  if (data.recentEmails.length > 0) {
    const highPriority = data.recentEmails.filter(e => e.priority === 'high' || e.action_needed)
    const emails = highPriority.slice(0, 5).map(e =>
      `- [${e.priority}] ${e.subject} — from ${e.from}${e.action_needed ? ' (ACTION NEEDED)' : ''}${e.snippet ? `\n  "${(e.snippet as string).substring(0, 120)}"` : ''}`
    ).join('\n')
    sections.push(`## Important Emails (${highPriority.length} high-priority of ${data.recentEmails.length} total)\n${emails || 'No high-priority emails.'}`)
  }

  // EOS: All Rocks with progress
  if (data.eosData.rocks.length > 0) {
    const rocks = data.eosData.rocks.map(r => {
      const milestones = r.milestones as Array<{ title: string; completed: boolean }> | null
      const total = milestones?.length || 0
      const done = milestones?.filter(m => m.completed).length || 0
      const progress = total > 0 ? `${done}/${total} milestones` : 'no milestones'
      const daysLeft = r.due_date ? Math.ceil((new Date(r.due_date as string).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null
      const dueInfo = daysLeft !== null ? (daysLeft <= 0 ? 'OVERDUE' : `${daysLeft} days left`) : ''
      return `- [${(r.status as string).toUpperCase()}] ${r.title} — ${ownerName(r.owner_id)} (${progress}, ${dueInfo})`
    }).join('\n')
    const atRiskCount = data.eosData.rocks.filter(r => r.status === 'at_risk' || r.status === 'off_track').length
    sections.push(`## Rocks (${data.eosData.rocks.length} active, ${atRiskCount} at risk/off track)\n${rocks}`)
  }

  // EOS: Overdue To-dos
  if (data.eosData.overdueTodos.length > 0) {
    const todos = data.eosData.overdueTodos
      .map(t => `- ${t.title} — ${ownerName(t.owner_id)} (due ${t.due_date})`)
      .join('\n')
    sections.push(`## Overdue To-dos (${data.eosData.overdueTodos.length})\n${todos}`)
  }

  // Upcoming To-dos
  if (data.eosData.upcomingTodos.length > 0) {
    const todos = data.eosData.upcomingTodos
      .map(t => `- ${t.title} — ${ownerName(t.owner_id)} (due ${t.due_date})`)
      .join('\n')
    sections.push(`## Upcoming To-dos (next 7 days)\n${todos}`)
  }

  // Todo completion rate
  if (data.eosData.todoCompletionRate) {
    const { completed, total } = data.eosData.todoCompletionRate
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0
    const target = 90
    const status = rate >= target ? 'ON TRACK' : 'BELOW TARGET'
    sections.push(`## To-do Completion Rate (last 2 weeks)\n${completed}/${total} completed (${rate}%) — target ${target}% [${status}]`)
  }

  // Scorecard trends
  const scorecardWithData = data.eosData.scorecardTrends.filter(m =>
    (m as Record<string, unknown>).latest_value !== null
  )
  if (scorecardWithData.length > 0) {
    const metrics = scorecardWithData.map(m => {
      const metric = m as Record<string, unknown>
      const trend = metric.trend || ''
      const misses = metric.consecutive_misses as number
      const missWarning = misses >= 3 ? ' ⚠️ 3+ WEEKS OFF TRACK' : misses >= 2 ? ' (2 weeks off)' : ''
      return `- ${metric.name}: ${metric.latest_value}${metric.unit === '$' ? '' : ` ${metric.unit}`} ${trend} (target: ${metric.target}) — ${ownerName(metric.owner_id)}${missWarning}`
    }).join('\n')
    const offTrackCount = scorecardWithData.filter(m => (m as Record<string, unknown>).consecutive_misses as number >= 1).length
    sections.push(`## Scorecard (${scorecardWithData.length} metrics, ${offTrackCount} off track)\n${metrics}`)
  }

  // EOS: Open Issues
  if (data.eosData.openIssues.length > 0) {
    const issues = data.eosData.openIssues
      .map(i => `- [P${i.priority}] ${i.title} [${i.status}] — ${ownerName(i.owner_id)}`)
      .join('\n')
    sections.push(`## Open Issues for IDS (${data.eosData.openIssues.length})\n${issues}`)
  }

  // Financial insights from Financial Strategist
  if (data.financialInsights) {
    const fi = data.financialInsights
    const fiSections: string[] = []

    if (fi.headline) fiSections.push(`**Headline: ${fi.headline}**`)
    if (fi.summary) fiSections.push(`Summary: ${fi.summary}`)

    const arAlerts = fi.ar_aging_alerts as Array<{ client_name: string; days_outstanding: number; amount_due: number; risk_level: string }> | undefined
    if (arAlerts && arAlerts.length > 0) {
      fiSections.push('AR Alerts:\n' + arAlerts.map(a =>
        `- [${a.risk_level.toUpperCase()}] ${a.client_name}: $${a.amount_due.toLocaleString()} — ${a.days_outstanding} days outstanding`
      ).join('\n'))
    }

    const marginAnalysis = fi.margin_analysis as Array<{ client_name: string; revenue: number; estimated_margin_pct: number; trend_indicator: string; wow_change_pct: number | null }> | undefined
    if (marginAnalysis && marginAnalysis.length > 0) {
      fiSections.push('Client Margins:\n' + marginAnalysis.map(m => {
        const wow = m.wow_change_pct !== null ? ` (${m.wow_change_pct > 0 ? '+' : ''}${m.wow_change_pct}% WoW)` : ''
        return `- ${m.client_name}: ${m.estimated_margin_pct}% margin ${m.trend_indicator}${wow} — $${m.revenue.toLocaleString()} revenue`
      }).join('\n'))
    }

    const concentration = fi.concentration_risk as { top_client_name: string; top_client_pct: number; is_above_threshold: boolean; trend_indicator: string } | undefined
    if (concentration?.is_above_threshold) {
      fiSections.push(`Concentration Risk: ${concentration.top_client_name} at ${concentration.top_client_pct}% of revenue ${concentration.trend_indicator} (threshold: 60%)`)
    }

    const cashFlow = fi.cash_flow_assessment as { net_position: string; note: string; trend_indicator: string; runway_note: string } | undefined
    if (cashFlow) {
      fiSections.push(`Cash Flow: ${cashFlow.net_position} ${cashFlow.trend_indicator} — ${cashFlow.note}\nRunway: ${cashFlow.runway_note}`)
    }

    sections.push(`## Financial Insights (Financial Strategist)\n${fiSections.join('\n')}`)
  }

  // Sales Pipeline (HubSpot)
  if (data.pipelineData) {
    const pd = data.pipelineData
    const pipelineSections: string[] = []

    pipelineSections.push(`Total Pipeline: $${pd.totalPipelineValue.toLocaleString()} across ${pd.deals.length} deals`)

    if (pd.closingSoon.length > 0) {
      const closing = pd.closingSoon.map(d =>
        `- ${d.deal_name}: $${((d.amount as number) || 0).toLocaleString()} (closes ${d.close_date}, stage: ${d.stage})`
      ).join('\n')
      pipelineSections.push(`Closing This Week (${pd.closingSoon.length}):\n${closing}`)
    }

    if (pd.overdueDeals.length > 0) {
      const overdue = pd.overdueDeals.map(d =>
        `- ${d.deal_name}: $${((d.amount as number) || 0).toLocaleString()} (was due ${d.close_date}, ${Math.abs(d.days_until_close as number)} days overdue)`
      ).join('\n')
      pipelineSections.push(`Overdue Close Dates (${pd.overdueDeals.length}):\n${overdue}`)
    }

    // Top deals by value
    const topDeals = [...pd.deals]
      .sort((a, b) => ((b.amount as number) || 0) - ((a.amount as number) || 0))
      .slice(0, 5)
      .map(d => {
        const daysLeft = d.days_until_close as number | null
        const dueInfo = daysLeft !== null ? (daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`) : 'no close date'
        return `- ${d.deal_name}: $${((d.amount as number) || 0).toLocaleString()} — ${d.stage} (${dueInfo})`
      }).join('\n')
    pipelineSections.push(`Top Deals by Value:\n${topDeals}`)

    sections.push(`## Sales Pipeline (HubSpot)\n${pipelineSections.join('\n')}`)
  }

  // BD Strategist pipeline insights
  if (data.bdInsights) {
    const bd = data.bdInsights
    const bdSections: string[] = []

    if (bd.headline) bdSections.push(`**Headline: ${bd.headline}**`)

    const health = bd.pipeline_health as { total_value: number; deal_count: number; trend_indicator: string; trend_note: string } | undefined
    if (health) {
      bdSections.push(`Pipeline: $${health.total_value.toLocaleString()} across ${health.deal_count} deals ${health.trend_indicator} — ${health.trend_note}`)
    }

    const atRisk = bd.deals_at_risk as Array<{ deal_name: string; amount: number; risk_reason: string; recommended_action: string }> | undefined
    if (atRisk && atRisk.length > 0) {
      bdSections.push('Deals at Risk:\n' + atRisk.map(d =>
        `- ${d.deal_name}: $${d.amount.toLocaleString()} — ${d.risk_reason}. Action: ${d.recommended_action}`
      ).join('\n'))
    }

    const closing = bd.closing_this_week as Array<{ deal_name: string; amount: number; close_date: string; confidence_note: string }> | undefined
    if (closing && closing.length > 0) {
      bdSections.push('Closing This Week:\n' + closing.map(d =>
        `- ${d.deal_name}: $${d.amount.toLocaleString()} (${d.close_date}) — ${d.confidence_note}`
      ).join('\n'))
    }

    sections.push(`## BD Strategist Insights\n${bdSections.join('\n')}`)
  }

  // Transcript highlights (yesterday's meetings)
  if (data.transcriptHighlights.length > 0) {
    const transcripts = data.transcriptHighlights.map(t => {
      const parts: string[] = [`### ${t.meeting_title} [${t.meeting_type}]`]
      if (t.summary) parts.push(`Summary: ${t.summary}`)
      if (t.key_points.length > 0) parts.push(`Key points:\n${t.key_points.map(k => `  - ${k}`).join('\n')}`)
      if (t.action_items.length > 0) parts.push(`Action items:\n${t.action_items.map(a => `  - ${a}`).join('\n')}`)
      if (t.decisions.length > 0) parts.push(`Decisions:\n${t.decisions.map(d => `  - ${d}`).join('\n')}`)
      return parts.join('\n')
    }).join('\n\n')
    sections.push(`## ${getTranscriptLabel()} (${data.transcriptHighlights.length} transcripts)\n${transcripts}`)
  }

  // Agent outputs
  if (data.agentOutputs.length > 0) {
    const outputs = data.agentOutputs
      .map(o => `- [${o.agent_id}/${o.output_type}] ${o.title}: ${o.summary || 'No summary'}`)
      .join('\n')
    sections.push(`## Agent Work (Overnight)\n${outputs}`)
  }

  return `Generate the morning briefing for ${data.today}. Synthesize the following data into a three-tier format.

${sections.join('\n\n')}

Instructions:
- Tier 1 (Urgent, 0-3 items): Items needing action TODAY. Include: overdue EOS items, critical emails needing response, meetings with external attendees requiring prep, financial threshold breaches (AR > 45 days, margin < 30%, concentration > 60%), Rocks that are off-track with milestones overdue, deals closing today or with overdue close dates.
- Tier 2 (Business, 3-7 items): Calendar overview (today and upcoming), EOS status updates (Rocks progress, Scorecard trends, To-do completion rate), financial highlights, pipeline summary (total value, deals closing soon, top deals), agent insights, important-but-not-urgent context.
- Tier 3 (FYI, 0-3 items): Lower-priority items, upcoming deadlines that aren't urgent yet, informational context.
- Include specific names, dollar amounts, dates, percentages, and trends (↑↓→). Never say "some items" or "several issues" — be exact.
- For Rocks, mention milestone progress and days until due.
- For Scorecard metrics, mention consecutive misses and trend direction.
- For To-dos, mention the owner name and due date.
- Financial insights from the Financial Strategist should be prominently featured — AR alerts and threshold breaches in Tier 1, cash flow and margins in Tier 2.
- If transcript highlights are available from yesterday's meetings, incorporate key follow-ups and action items into Tier 1 (if urgent) or Tier 2. Mention specific commitments people made and decisions that affect upcoming work.`
}
