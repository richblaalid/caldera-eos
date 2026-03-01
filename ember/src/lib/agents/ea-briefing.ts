import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import type { BriefingItem, AgentWorkItem, BriefingInsert, TacticalItem, StrategicItem, FYIItem, BriefingInsertV2 } from '@/types/agents'
import { getSmartLookback, getTranscriptLabel } from './lookback'
import { fetchIndustryNews, type NewsItem } from '@/lib/connectors/brave-search-client'
import { runPatternDetection, type PatternAlert } from './pattern-detector'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Convert a Date to YYYY-MM-DD in a specific timezone */
function toLocalDate(date: Date, timezone: string): string {
  return date.toLocaleDateString('en-CA', { timeZone: timezone }) // en-CA gives YYYY-MM-DD
}

/** Get day-of-week label for a date in a specific timezone */
function toDayLabel(dateStr: string, timezone: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone })
}

// v1 schema (kept for backward compat with old briefings)
const briefingSchemaV1 = z.object({
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
    source: z.string().describe('Where this came from. For industry news items, use the full URL (e.g. https://...). For other items use: calendar, email, rock, todo, scorecard, financial'),
  })).describe('Tier 3: Industry context and lower-priority items (0-3 items)'),
})

// v2 schema: Tactical daily (3-5 items) + Strategic Monday (3-5 items)
const briefingSchemaV2 = z.object({
  tactical_items: z.array(z.object({
    title: z.string().describe('Action-verb title: Reply, Prepare, Follow up, Review, Sign, Send, etc. Must start with a verb.'),
    context: z.string().describe('One sentence of context — why this matters or what is at stake. Be specific: use exact names, amounts, dates from VERIFIED FACTS.'),
    source: z.string().describe('Data source: calendar, email, todo, rock, deal, transcript, scorecard, financial'),
    urgency: z.enum(['must-do', 'should-do']).describe('must-do = will cost money/reputation if skipped today. should-do = important but can wait 24h.'),
  })).min(1).max(5).describe('3-5 tactical items the partner must DO today. Each starts with an action verb.'),

  strategic_items: z.array(z.object({
    title: z.string().describe('Metric headline — exact number from VERIFIED FACTS. e.g. "Pipeline at $425K across 8 deals"'),
    detail: z.string().describe('One sentence: what changed vs. last week and what it means. Use exact numbers.'),
    category: z.enum(['financial', 'pipeline', 'rocks', 'positioning', 'pattern']).describe('Which business area this covers'),
    trend: z.enum(['improving', 'stable', 'declining', 'new']).describe('Direction vs. last week'),
  })).describe('Strategic pulse items — ONLY populated on Mondays. Empty array on Tue-Fri.'),

  fyi_item: z.object({
    text: z.string().describe('One-line FYI if something notable but not actionable. Omit if nothing qualifies.'),
    source: z.string().describe('Source URL or label'),
  }).nullable().describe('Optional single FYI item. Null if nothing notable.'),
})

/**
 * Generate a v2 morning briefing for a partner.
 * Daily (Tue-Fri): 3-5 tactical items only.
 * Monday: tactical items + strategic pulse (3-5 business health signals).
 * Passes verified facts (deal names, amounts, dates) verbatim to prevent LLM hallucination.
 */
export async function generateBriefing(
  partnerId: string,
  organizationId: string,
  timezone: string = 'America/Chicago'
): Promise<BriefingInsertV2> {
  const now = new Date()
  const today = toLocalDate(now, timezone)
  const dayOfWeek = new Date(today + 'T12:00:00').getDay() // 0=Sun, 1=Mon
  const isMonday = dayOfWeek === 1

  // Daily data sources (always fetched) — lightweight
  const [calendarEvents, recentEmails, eosData, agentOutputs, pipelineData, transcriptHighlights, ownerNames] = await Promise.all([
    getCalendarEvents(organizationId, timezone),
    getRecentEmails(organizationId),
    getEOSData(organizationId),
    getPendingAgentOutputs(organizationId),
    getLightweightPipelineData(organizationId),
    getTranscriptHighlights(organizationId),
    getOwnerNames(organizationId),
  ])

  // Monday-only data sources (expensive — skip Tue-Fri to save cost + tokens)
  let financialInsights: Record<string, unknown> | null = null
  let fullPipelineData: PipelineData | null = null
  let bdInsights: Record<string, unknown> | null = null
  let opsInsights: Record<string, unknown> | null = null
  let marketingInsights: Record<string, unknown> | null = null
  let innovationInsights: Record<string, unknown> | null = null
  let industryNews: NewsItem[] = []
  let patternAlerts: PatternAlert[] = []
  let coachingHighlights: CoachingHighlight[] = []

  if (isMonday) {
    const [fi, fpd, bd, ops, mkt, inn, news, patterns, coaching] = await Promise.all([
      getFinancialInsights(organizationId),
      getPipelineData(organizationId),
      getBDStrategistInsights(organizationId),
      getOperationsInsights(organizationId),
      getMarketingInsights(organizationId),
      getInnovationInsights(organizationId),
      fetchIndustryNews(),
      runPatternDetection(organizationId).catch(() => [] as PatternAlert[]),
      getRecentCoaching(organizationId),
    ])
    financialInsights = fi
    fullPipelineData = fpd
    bdInsights = bd
    opsInsights = ops
    marketingInsights = mkt
    innovationInsights = inn
    industryNews = news
    patternAlerts = patterns
    coachingHighlights = coaching
  }

  // Build verified facts block (verbatim data the LLM must use exactly)
  const verifiedFacts = buildVerifiedFacts({
    pipelineData: fullPipelineData || pipelineData,
    eosData,
    financialInsights,
    ownerNames,
  })

  // Build the user prompt with all available data
  const prompt = buildBriefingPromptV2({
    calendarEvents,
    recentEmails,
    eosData,
    agentOutputs,
    financialInsights,
    pipelineData: fullPipelineData || pipelineData,
    bdInsights,
    opsInsights,
    marketingInsights,
    innovationInsights,
    transcriptHighlights,
    coachingHighlights,
    ownerNames,
    industryNews,
    patternAlerts,
    verifiedFacts,
    today,
    isMonday,
  })

  const model = process.env.AGENT_DEFAULT_MODEL || 'claude-sonnet-4-20250514'
  const systemPrompt = buildEASystemPromptV2(today, isMonday)

  const { object } = await generateObject({
    model: anthropic(model),
    system: systemPrompt,
    prompt,
    schema: briefingSchemaV2,
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

  // Add IDs to tactical and strategic items
  const tacticalItems: TacticalItem[] = object.tactical_items.map((item, idx) => ({
    id: String(idx + 1),
    ...item,
  }))

  const strategicItems: StrategicItem[] = object.strategic_items.map((item, idx) => ({
    id: String(idx + 1),
    ...item,
  }))

  const fyiItem: FYIItem | null = object.fyi_item || null

  return {
    organization_id: organizationId,
    partner_id: partnerId,
    briefing_date: today,
    briefing_version: 2,
    is_monday: isMonday,
    tactical_items: tacticalItems,
    strategic_items: strategicItems,
    fyi_item: fyiItem,
    agent_work_queue: agentWorkQueue,
  }
}

/**
 * Generate a v1 briefing (backward compat — used by old code paths if needed).
 */
export async function generateBriefingV1(
  partnerId: string,
  organizationId: string,
  timezone: string = 'America/Chicago'
): Promise<BriefingInsert> {
  const today = toLocalDate(new Date(), timezone)

  const [calendarEvents, recentEmails, eosData, agentOutputs, financialInsights, pipelineData, bdInsights, opsInsights, marketingInsights, innovationInsights, transcriptHighlights, coachingHighlights, ownerNames, industryNews, patternAlerts] = await Promise.all([
    getCalendarEvents(organizationId, timezone),
    getRecentEmails(organizationId),
    getEOSData(organizationId),
    getPendingAgentOutputs(organizationId),
    getFinancialInsights(organizationId),
    getPipelineData(organizationId),
    getBDStrategistInsights(organizationId),
    getOperationsInsights(organizationId),
    getMarketingInsights(organizationId),
    getInnovationInsights(organizationId),
    getTranscriptHighlights(organizationId),
    getRecentCoaching(organizationId),
    getOwnerNames(organizationId),
    fetchIndustryNews(),
    runPatternDetection(organizationId).catch(() => [] as PatternAlert[]),
  ])

  const prompt = buildBriefingPrompt({
    calendarEvents, recentEmails, eosData, agentOutputs, financialInsights, pipelineData, bdInsights, opsInsights, marketingInsights, innovationInsights, transcriptHighlights, coachingHighlights, ownerNames, industryNews, patternAlerts, today,
  })

  const model = process.env.AGENT_DEFAULT_MODEL || 'claude-sonnet-4-20250514'
  const systemPrompt = buildEASystemPrompt(today)

  const { object } = await generateObject({
    model: anthropic(model),
    system: systemPrompt,
    prompt,
    schema: briefingSchemaV1,
  })

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

  const addIds = (items: Array<{ title: string; detail: string; source: string; action_needed?: boolean }>): BriefingItem[] =>
    items.map((item, idx) => ({ id: String(idx + 1), ...item }))

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
export async function saveBriefing(briefing: BriefingInsert | BriefingInsertV2): Promise<string | null> {
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
// v2 System Prompt — Tactical + Strategic
// ============================================

function buildEASystemPromptV2(today: string, isMonday: boolean): string {
  return `You are Ember, preparing a concise daily briefing for a busy CEO. Your ONE job: tell them what to DO today.

## Rules
1. Every tactical item MUST start with an action verb: Reply, Prepare, Follow up, Review, Sign, Send, Schedule, Approve, Reject, Call.
2. Use EXACT data from the VERIFIED FACTS section. Never round, rename, or paraphrase deal names, dollar amounts, or dates. If a deal is called "PLG Engagement" in verified facts, write "PLG Engagement" — not "PLG deal" or "PLG project."
3. If you don't have a number for something, write "data unavailable" — never invent one.
4. Data from meeting transcripts may contain transcription errors (e.g., "Shields" might be "SCHEELS"). Flag transcript-sourced data as approximate when names or numbers seem uncertain.
5. Keep each item to 1-2 lines. The partner should scan the entire briefing in 15 seconds (daily) or 60 seconds (Monday).
6. 3-5 tactical items max. Prioritize by: (a) will cost money/reputation if ignored today, (b) has a deadline today, (c) someone is waiting on a response.
${isMonday ? `7. This is Monday — also generate 3-5 strategic pulse items with exact metrics and trend vs. last week. Use verified financial and pipeline data.` : `7. This is ${new Date(today + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })} — strategic_items must be an empty array.`}

## Caldera Context
- 14-person software services company (~$2.5M revenue)
- Three partners: Rich (CEO/CFO/COO/Integrator), John (Sales), Wade (Engineering/Solutions)
- 73% revenue from single anchor client — diversification is existential
- Running EOS (Traction) — L10 meetings, quarterly Rocks, weekly Scorecard
- Transforming from T&M to value-based fixed-fee; repositioning as "AI-powered product consultancy"

Today is ${today}.`
}

// ============================================
// Verified Facts Builder
// ============================================

function buildVerifiedFacts(data: {
  pipelineData: PipelineData | null
  eosData: EOSData
  financialInsights: Record<string, unknown> | null
  ownerNames: Map<string, string>
}): string {
  const sections: string[] = []
  const ownerName = (id: unknown) => (id && data.ownerNames.get(id as string)) || 'Unassigned'

  // HubSpot deals — verbatim names, amounts, stages, close dates
  if (data.pipelineData && data.pipelineData.deals.length > 0) {
    const dealLines = data.pipelineData.deals.map(d => {
      const amount = (d.amount as number) || 0
      const stage = d.stage || 'Unknown'
      const closeDate = d.close_date || 'No close date'
      const daysUntil = d.days_until_close as number | null
      const overdue = daysUntil !== null && daysUntil < 0
      return `  - Deal: "${d.deal_name}" | Amount: $${amount.toLocaleString()} | Stage: ${stage} | Close: ${closeDate}${overdue ? ` (${Math.abs(daysUntil!)} days OVERDUE)` : daysUntil !== null ? ` (${daysUntil} days)` : ''}`
    }).join('\n')
    const total = data.pipelineData.totalPipelineValue
    sections.push(`[VERIFIED — HubSpot Pipeline]\nTotal Pipeline: $${total.toLocaleString()} across ${data.pipelineData.deals.length} deals\n${dealLines}`)
  }

  // Financial metrics — verbatim from QBO/Financial Strategist
  if (data.financialInsights) {
    const fi = data.financialInsights
    const fiLines: string[] = []

    const cashFlow = fi.cash_flow_assessment as { net_position: string; runway_note: string; trend_indicator: string } | undefined
    if (cashFlow) {
      fiLines.push(`  - Cash Flow: ${cashFlow.net_position} ${cashFlow.trend_indicator} | Runway: ${cashFlow.runway_note}`)
    }

    const concentration = fi.concentration_risk as { top_client_name: string; top_client_pct: number; trend_indicator: string } | undefined
    if (concentration) {
      fiLines.push(`  - Concentration: ${concentration.top_client_name} at ${concentration.top_client_pct}% ${concentration.trend_indicator}`)
    }

    const arAlerts = fi.ar_aging_alerts as Array<{ client_name: string; days_outstanding: number; amount_due: number; risk_level: string }> | undefined
    if (arAlerts && arAlerts.length > 0) {
      for (const a of arAlerts) {
        fiLines.push(`  - AR: "${a.client_name}" owes $${a.amount_due.toLocaleString()} — ${a.days_outstanding} days outstanding [${a.risk_level}]`)
      }
    }

    const marginAnalysis = fi.margin_analysis as Array<{ client_name: string; estimated_margin_pct: number; trend_indicator: string }> | undefined
    if (marginAnalysis && marginAnalysis.length > 0) {
      for (const m of marginAnalysis) {
        fiLines.push(`  - Margin: "${m.client_name}" at ${m.estimated_margin_pct}% ${m.trend_indicator}`)
      }
    }

    if (fiLines.length > 0) {
      sections.push(`[VERIFIED — QuickBooks/Financial]\n${fiLines.join('\n')}`)
    }
  }

  // EOS data — verbatim rock titles, todo titles, scorecard values
  const eosLines: string[] = []

  if (data.eosData.rocks.length > 0) {
    for (const r of data.eosData.rocks) {
      const milestones = r.milestones as Array<{ title: string; completed: boolean }> | null
      const total = milestones?.length || 0
      const done = milestones?.filter(m => m.completed).length || 0
      eosLines.push(`  - Rock: "${r.title}" | Status: ${r.status} | Owner: ${ownerName(r.owner_id)} | Progress: ${done}/${total} milestones | Due: ${r.due_date || 'No date'}`)
    }
  }

  if (data.eosData.overdueTodos.length > 0) {
    for (const t of data.eosData.overdueTodos) {
      eosLines.push(`  - OVERDUE Todo: "${t.title}" | Owner: ${ownerName(t.owner_id)} | Due: ${t.due_date}`)
    }
  }

  if (data.eosData.upcomingTodos.length > 0) {
    for (const t of data.eosData.upcomingTodos) {
      eosLines.push(`  - Todo: "${t.title}" | Owner: ${ownerName(t.owner_id)} | Due: ${t.due_date}`)
    }
  }

  if (data.eosData.todoCompletionRate) {
    const { completed, total } = data.eosData.todoCompletionRate
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0
    eosLines.push(`  - Todo Completion (2 weeks): ${completed}/${total} = ${rate}% (target: 90%)`)
  }

  const scorecardWithData = data.eosData.scorecardTrends.filter(m => (m as Record<string, unknown>).latest_value !== null)
  if (scorecardWithData.length > 0) {
    for (const m of scorecardWithData) {
      const metric = m as Record<string, unknown>
      const misses = metric.consecutive_misses as number
      eosLines.push(`  - Scorecard: "${metric.name}" = ${metric.latest_value} ${metric.unit} ${metric.trend || ''} (target: ${metric.target}) | Owner: ${ownerName(metric.owner_id)}${misses >= 2 ? ` | ${misses} weeks off track` : ''}`)
    }
  }

  if (eosLines.length > 0) {
    sections.push(`[VERIFIED — EOS/Supabase]\n${eosLines.join('\n')}`)
  }

  return sections.length > 0
    ? `═══ VERIFIED FACTS — Use these EXACTLY. Do not rename, round, or paraphrase. ═══\n\n${sections.join('\n\n')}\n\n═══ END VERIFIED FACTS ═══`
    : ''
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

async function getCalendarEvents(organizationId: string, timezone: string) {
  const now = new Date()
  const todayStr = toLocalDate(now, timezone)
  const weekOut = toLocalDate(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), timezone)

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

  // Tag each event as today vs. upcoming, using the partner's local timezone
  return (data || []).map(d => {
    const payload = d.payload as Record<string, unknown>
    const eventLocalDate = d.source_timestamp
      ? toLocalDate(new Date(d.source_timestamp), timezone)
      : ''
    const dayLabel = d.source_timestamp
      ? toDayLabel(d.source_timestamp, timezone)
      : ''
    return { ...payload, _is_today: eventLocalDate === todayStr, _date: eventLocalDate, _day: dayLabel }
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
    'operations-architect': 'Operations Architect',
    'marketing-strategist': 'Marketing Strategist',
    'pattern-detector': 'Pattern Detector',
    'product-innovation': 'Product Innovation Officer',
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

async function getOperationsInsights(organizationId: string) {
  const oneDayAgo = getSmartLookback(24)

  const { data } = await supabaseAdmin
    .from('agent_outputs')
    .select('title, summary, content')
    .eq('organization_id', organizationId)
    .eq('agent_id', 'operations-architect')
    .eq('output_type', 'analysis')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!data || data.length === 0) return null

  return data[0].content as Record<string, unknown>
}

async function getMarketingInsights(organizationId: string) {
  // Marketing runs weekly — look back further (7 days)
  const sevenDaysAgo = getSmartLookback(168)

  const { data } = await supabaseAdmin
    .from('agent_outputs')
    .select('title, summary, content')
    .eq('organization_id', organizationId)
    .eq('agent_id', 'marketing-strategist')
    .eq('output_type', 'analysis')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!data || data.length === 0) return null

  return data[0].content as Record<string, unknown>
}

async function getInnovationInsights(organizationId: string) {
  // Innovation runs weekly — look back further (7 days)
  const sevenDaysAgo = getSmartLookback(168)

  const { data } = await supabaseAdmin
    .from('agent_outputs')
    .select('title, summary, content')
    .eq('organization_id', organizationId)
    .eq('agent_id', 'product-innovation')
    .eq('output_type', 'analysis')
    .gte('created_at', sevenDaysAgo)
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

/** Lightweight pipeline fetch — only deals closing soon or overdue (used daily Tue-Fri) */
async function getLightweightPipelineData(organizationId: string): Promise<PipelineData | null> {
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

interface CoachingHighlight {
  meeting_title: string
  meeting_date: string
  participants: string[]
  coaching_markdown: string
}

async function getRecentCoaching(organizationId: string): Promise<CoachingHighlight[]> {
  const twoDaysAgo = getSmartLookback(48)

  const { data } = await supabaseAdmin
    .from('ingested_data')
    .select('payload, source_timestamp')
    .eq('organization_id', organizationId)
    .eq('source', 'grain')
    .eq('data_type', 'coaching_feedback')
    .gte('source_timestamp', twoDaysAgo)
    .order('source_timestamp', { ascending: false })
    .limit(5)

  if (!data || data.length === 0) return []

  return data.map(d => {
    const p = d.payload as Record<string, unknown>
    return {
      meeting_title: (p.meeting_title as string) || 'Untitled',
      meeting_date: (p.meeting_date as string) || d.source_timestamp || '',
      participants: (p.participants as string[]) || [],
      coaching_markdown: (p.coaching_markdown as string) || '',
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
  opsInsights: Record<string, unknown> | null
  marketingInsights: Record<string, unknown> | null
  innovationInsights: Record<string, unknown> | null
  transcriptHighlights: TranscriptHighlight[]
  coachingHighlights: CoachingHighlight[]
  ownerNames: Map<string, string>
  industryNews: NewsItem[]
  patternAlerts: PatternAlert[]
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
      const day = e._day as string
      const time = typeof e.start === 'string' ? e.start.split('T')[1]?.substring(0, 5) : ''
      return `- ${day} ${date}${time ? ' ' + time : ''} ${e.title} [${e.event_type}]`
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

  // Operations Architect insights
  if (data.opsInsights) {
    const ops = data.opsInsights
    const opsSections: string[] = []

    if (ops.headline) opsSections.push(`**Headline: ${ops.headline}**`)

    const scopeAlerts = ops.scope_variance_alerts as Array<{ project_name: string; variance_type: string; risk_level: string; recommended_action: string }> | undefined
    if (scopeAlerts && scopeAlerts.length > 0) {
      opsSections.push('Scope Variance Alerts:\n' + scopeAlerts.map(a =>
        `- [${a.risk_level.toUpperCase()}] ${a.project_name}: ${a.variance_type} — ${a.recommended_action}`
      ).join('\n'))
    }

    const satisfaction = ops.client_satisfaction_signals as Array<{ client_name: string; signal_type: string; detail: string }> | undefined
    if (satisfaction && satisfaction.length > 0) {
      opsSections.push('Client Satisfaction:\n' + satisfaction.map(s =>
        `- [${s.signal_type.toUpperCase()}] ${s.client_name}: ${s.detail}`
      ).join('\n'))
    }

    const handoffs = ops.handoff_status as Array<{ deal_or_project: string; handoff_stage: string; gaps: string | null }> | undefined
    if (handoffs && handoffs.length > 0) {
      const atRisk = handoffs.filter(h => h.handoff_stage === 'at_risk' || h.gaps)
      if (atRisk.length > 0) {
        opsSections.push('Handoff Risks:\n' + atRisk.map(h =>
          `- ${h.deal_or_project}: ${h.handoff_stage}${h.gaps ? ` — ${h.gaps}` : ''}`
        ).join('\n'))
      }
    }

    if (opsSections.length > 0) {
      sections.push(`## Operations Insights (Operations Architect)\n${opsSections.join('\n')}`)
    }
  }

  // Marketing Strategist insights (weekly)
  if (data.marketingInsights) {
    const mkt = data.marketingInsights
    const mktSections: string[] = []

    if (mkt.headline) mktSections.push(`**Headline: ${mkt.headline}**`)

    const posScore = mkt.positioning_score as { score: number; rationale: string } | undefined
    if (posScore) {
      mktSections.push(`Positioning Score: ${posScore.score}/10 — ${posScore.rationale}`)
    }

    const competitors = mkt.competitive_landscape as Array<{ competitor: string; threat_level: string; notable_activity: string | null }> | undefined
    if (competitors && competitors.length > 0) {
      const highThreats = competitors.filter(c => c.threat_level === 'high' || c.notable_activity)
      if (highThreats.length > 0) {
        mktSections.push('Competitive Activity:\n' + highThreats.map(c =>
          `- [${c.threat_level.toUpperCase()}] ${c.competitor}${c.notable_activity ? `: ${c.notable_activity}` : ''}`
        ).join('\n'))
      }
    }

    const contentOpps = mkt.content_opportunities as Array<{ topic: string; priority: string; format: string }> | undefined
    if (contentOpps && contentOpps.length > 0) {
      const highPriority = contentOpps.filter(c => c.priority === 'high').slice(0, 3)
      if (highPriority.length > 0) {
        mktSections.push('Top Content Opportunities:\n' + highPriority.map(c =>
          `- ${c.topic} (${c.format})`
        ).join('\n'))
      }
    }

    if (mktSections.length > 0) {
      sections.push(`## Marketing & Positioning (Marketing Strategist)\n${mktSections.join('\n')}`)
    }
  }

  // Product Innovation insights (weekly)
  if (data.innovationInsights) {
    const inn = data.innovationInsights
    const innSections: string[] = []

    if (inn.headline) innSections.push(`**Headline: ${inn.headline}**`)

    const trends = inn.technology_trends as Array<{ trend: string; relevance: number; opportunity_type: string; time_horizon: string }> | undefined
    if (trends && trends.length > 0) {
      const highRelevance = trends.filter(t => t.relevance >= 7).slice(0, 3)
      if (highRelevance.length > 0) {
        innSections.push('Key Tech Trends:\n' + highRelevance.map(t =>
          `- ${t.trend} (relevance: ${t.relevance}/10, ${t.opportunity_type}, ${t.time_horizon})`
        ).join('\n'))
      }
    }

    const seeds = inn.opportunity_seeds as Array<{ idea: string; origin: string; potential: string }> | undefined
    if (seeds && seeds.length > 0) {
      innSections.push('Opportunity Seeds:\n' + seeds.slice(0, 3).map(s =>
        `- ${s.idea} [${s.origin}] — ${s.potential}`
      ).join('\n'))
    }

    if (innSections.length > 0) {
      sections.push(`## Product & Innovation (Innovation Officer)\n${innSections.join('\n')}`)
    }
  }

  // Pattern Detection alerts — "surface what's not being said"
  if (data.patternAlerts.length > 0) {
    const concerns = data.patternAlerts.filter(a => a.severity === 'concern' || a.severity === 'escalation')
    const observations = data.patternAlerts.filter(a => a.severity === 'observation')

    const alertLines: string[] = []
    for (const alert of concerns) {
      alertLines.push(`- [${alert.severity.toUpperCase()}] ${alert.title}\n  ${alert.detail}\n  Recommended: ${alert.recommended_action}`)
    }
    for (const alert of observations) {
      alertLines.push(`- [OBSERVATION] ${alert.title}\n  ${alert.detail}`)
    }

    sections.push(`## Pattern Observations (${data.patternAlerts.length} patterns detected)\n${alertLines.join('\n')}`)
  }

  // Sales coaching highlights (from Grain AI coaching)
  if (data.coachingHighlights.length > 0) {
    const coaching = data.coachingHighlights.map(c => {
      // Truncate coaching markdown to keep prompt reasonable
      const preview = c.coaching_markdown.length > 500
        ? c.coaching_markdown.slice(0, 500) + '...'
        : c.coaching_markdown
      return `### ${c.meeting_title} (${c.meeting_date.split('T')[0]})\nParticipants: ${c.participants.join(', ') || 'Unknown'}\n${preview}`
    }).join('\n\n')
    sections.push(`## Sales Coaching Highlights (${data.coachingHighlights.length} recent calls)\n${coaching}`)
  }

  // Industry news (Brave Search)
  if (data.industryNews.length > 0) {
    const news = data.industryNews.map(n =>
      `- ${n.title}: ${n.detail}\n  URL: ${n.source}`
    ).join('\n')
    sections.push(`## Industry News (${data.industryNews.length} items)\nUse the URL as the "source" field for each news item in Tier 3.\n${news}`)
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
- Tier 3 (FYI, 0-3 items): Industry news relevant to Caldera's positioning (AI services, digital transformation, competitive landscape), lower-priority items, upcoming deadlines. When industry news data is available, use it to create sourced Tier 3 items. IMPORTANT: For news items, set the "source" field to the full URL from the Industry News data (e.g. "https://example.com/article") — NOT a label like "industry" or "news". This enables clickable links in Slack. Focus on news connecting to Caldera's shift from "dev services" to "AI-powered product consultancy."
- Include specific names, dollar amounts, dates, percentages, and trends (↑↓→). Never say "some items" or "several issues" — be exact.
- For Rocks, mention milestone progress and days until due.
- For Scorecard metrics, mention consecutive misses and trend direction.
- For To-dos, mention the owner name and due date.
- Financial insights from the Financial Strategist should be prominently featured — AR alerts and threshold breaches in Tier 1, cash flow and margins in Tier 2.
- If transcript highlights are available from yesterday's meetings, incorporate key follow-ups and action items into Tier 1 (if urgent) or Tier 2. Mention specific commitments people made and decisions that affect upcoming work.
- If sales coaching highlights are available, include a summary in Tier 2 highlighting coaching opportunities and strengths. Reference specific meetings and participants.
- If pattern observations are available, surface CONCERN and ESCALATION patterns in Tier 1 (these are behavioral gaps the team may be avoiding). OBSERVATION patterns go in Tier 2. Pattern detection reveals what's NOT being said — stalled rocks marked on-track, scorecard misses without issues, topics avoided in meetings, and untracked commitments.`
}

// ============================================
// v2 Prompt builder — Tactical Daily + Strategic Monday
// ============================================

function buildBriefingPromptV2(data: {
  calendarEvents: Array<Record<string, unknown>>
  recentEmails: Array<Record<string, unknown>>
  eosData: EOSData
  agentOutputs: Array<Record<string, unknown>>
  financialInsights: Record<string, unknown> | null
  pipelineData: PipelineData | null
  bdInsights: Record<string, unknown> | null
  opsInsights: Record<string, unknown> | null
  marketingInsights: Record<string, unknown> | null
  innovationInsights: Record<string, unknown> | null
  transcriptHighlights: TranscriptHighlight[]
  coachingHighlights: CoachingHighlight[]
  ownerNames: Map<string, string>
  industryNews: NewsItem[]
  patternAlerts: PatternAlert[]
  verifiedFacts: string
  today: string
  isMonday: boolean
}): string {
  const sections: string[] = []
  const ownerName = (id: unknown) => (id && data.ownerNames.get(id as string)) || 'Unassigned'

  // VERIFIED FACTS at the top — the LLM must reference these exactly
  if (data.verifiedFacts) {
    sections.push(data.verifiedFacts)
  }

  // Calendar — today's events (always included)
  const todayEvents = data.calendarEvents.filter(e => e._is_today)
  if (todayEvents.length > 0) {
    const events = todayEvents.map(e => {
      const time = typeof e.start === 'string' ? e.start.split('T')[1]?.substring(0, 5) : ''
      const attendees = (e.attendees as string[] || [])
      return `- ${time ? time + ' ' : ''}${e.title} [${e.event_type}] — ${attendees.join(', ') || 'no attendees'}`
    }).join('\n')
    sections.push(`## Today's Calendar (${todayEvents.length} events)\n${events}`)
  } else {
    sections.push(`## Today's Calendar\nNo events scheduled today.`)
  }

  // Emails — high-priority only
  if (data.recentEmails.length > 0) {
    const highPriority = data.recentEmails.filter(e => e.priority === 'high' || e.action_needed)
    if (highPriority.length > 0) {
      const emails = highPriority.slice(0, 5).map(e =>
        `- [${e.priority}] ${e.subject} — from ${e.from}${e.action_needed ? ' (ACTION NEEDED)' : ''}${e.snippet ? `\n  "${(e.snippet as string).substring(0, 120)}"` : ''}`
      ).join('\n')
      sections.push(`## Emails Needing Response (${highPriority.length})\n${emails}`)
    }
  }

  // Overdue To-dos — these become tactical items
  if (data.eosData.overdueTodos.length > 0) {
    const todos = data.eosData.overdueTodos
      .map(t => `- "${t.title}" — ${ownerName(t.owner_id)} (due ${t.due_date})`)
      .join('\n')
    sections.push(`## OVERDUE To-dos (${data.eosData.overdueTodos.length})\n${todos}`)
  }

  // Due-today or upcoming To-dos
  if (data.eosData.upcomingTodos.length > 0) {
    const todos = data.eosData.upcomingTodos
      .map(t => `- "${t.title}" — ${ownerName(t.owner_id)} (due ${t.due_date})`)
      .join('\n')
    sections.push(`## Upcoming To-dos (next 7 days)\n${todos}`)
  }

  // Deals closing soon or overdue (daily — lightweight pipeline)
  if (data.pipelineData) {
    if (data.pipelineData.closingSoon.length > 0 || data.pipelineData.overdueDeals.length > 0) {
      const dealLines: string[] = []
      for (const d of data.pipelineData.overdueDeals) {
        dealLines.push(`- OVERDUE: "${d.deal_name}" $${((d.amount as number) || 0).toLocaleString()} (was due ${d.close_date})`)
      }
      for (const d of data.pipelineData.closingSoon) {
        dealLines.push(`- Closing soon: "${d.deal_name}" $${((d.amount as number) || 0).toLocaleString()} (closes ${d.close_date})`)
      }
      sections.push(`## Deals Needing Attention\n${dealLines.join('\n')}`)
    }
  }

  // Transcript action items from yesterday's meetings
  if (data.transcriptHighlights.length > 0) {
    const actionItems: string[] = []
    for (const t of data.transcriptHighlights) {
      if (t.action_items.length > 0) {
        actionItems.push(`From "${t.meeting_title}" [${t.meeting_type}]:`)
        for (const a of t.action_items) {
          actionItems.push(`  - ${a}`)
        }
      }
    }
    if (actionItems.length > 0) {
      sections.push(`## [FROM TRANSCRIPTS — names/numbers may have transcription errors]\n${actionItems.join('\n')}`)
    }
  }

  // Off-track Rocks (daily — always surface these)
  const offTrackRocks = data.eosData.rocks.filter(r => r.status === 'off_track' || r.status === 'at_risk')
  if (offTrackRocks.length > 0) {
    const rocks = offTrackRocks.map(r => {
      const milestones = r.milestones as Array<{ title: string; completed: boolean }> | null
      const total = milestones?.length || 0
      const done = milestones?.filter(m => m.completed).length || 0
      return `- [${(r.status as string).toUpperCase()}] "${r.title}" — ${ownerName(r.owner_id)} (${done}/${total} milestones, due ${r.due_date || 'no date'})`
    }).join('\n')
    sections.push(`## Off-Track Rocks (${offTrackRocks.length})\n${rocks}`)
  }

  // === MONDAY-ONLY SECTIONS ===
  if (data.isMonday) {
    // All Rocks (Monday strategic view)
    if (data.eosData.rocks.length > 0) {
      const rocks = data.eosData.rocks.map(r => {
        const milestones = r.milestones as Array<{ title: string; completed: boolean }> | null
        const total = milestones?.length || 0
        const done = milestones?.filter(m => m.completed).length || 0
        const daysLeft = r.due_date ? Math.ceil((new Date(r.due_date as string).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null
        return `- [${(r.status as string).toUpperCase()}] "${r.title}" — ${ownerName(r.owner_id)} (${done}/${total} milestones, ${daysLeft !== null ? (daysLeft <= 0 ? 'OVERDUE' : `${daysLeft}d left`) : 'no due date'})`
      }).join('\n')
      sections.push(`## All Rocks (${data.eosData.rocks.length} active)\n${rocks}`)
    }

    // Scorecard trends (Monday)
    const scorecardWithData = data.eosData.scorecardTrends.filter(m => (m as Record<string, unknown>).latest_value !== null)
    if (scorecardWithData.length > 0) {
      const metrics = scorecardWithData.map(m => {
        const metric = m as Record<string, unknown>
        const misses = metric.consecutive_misses as number
        return `- "${metric.name}": ${metric.latest_value} ${metric.unit} ${metric.trend || ''} (target: ${metric.target}) — ${ownerName(metric.owner_id)}${misses >= 2 ? ` [${misses} weeks off]` : ''}`
      }).join('\n')
      sections.push(`## Scorecard Trends\n${metrics}`)
    }

    // Financial insights (Monday)
    if (data.financialInsights) {
      const fi = data.financialInsights
      const fiLines: string[] = []
      if (fi.headline) fiLines.push(`Headline: ${fi.headline}`)
      if (fi.summary) fiLines.push(`${fi.summary}`)
      if (fiLines.length > 0) {
        sections.push(`## Financial Analysis (Financial Strategist)\n${fiLines.join('\n')}`)
      }
    }

    // Full pipeline (Monday)
    if (data.pipelineData && data.pipelineData.deals.length > 0) {
      const topDeals = [...data.pipelineData.deals]
        .sort((a, b) => ((b.amount as number) || 0) - ((a.amount as number) || 0))
        .slice(0, 5)
        .map(d => `- "${d.deal_name}": $${((d.amount as number) || 0).toLocaleString()} — ${d.stage}`)
        .join('\n')
      sections.push(`## Full Pipeline (Monday)\nTotal: $${data.pipelineData.totalPipelineValue.toLocaleString()} across ${data.pipelineData.deals.length} deals\n${topDeals}`)
    }

    // BD Strategist insights (Monday)
    if (data.bdInsights) {
      const bd = data.bdInsights
      const bdLines: string[] = []
      if (bd.headline) bdLines.push(`${bd.headline}`)
      const atRisk = bd.deals_at_risk as Array<{ deal_name: string; amount: number; risk_reason: string }> | undefined
      if (atRisk && atRisk.length > 0) {
        for (const d of atRisk) {
          bdLines.push(`- At risk: "${d.deal_name}" $${d.amount.toLocaleString()} — ${d.risk_reason}`)
        }
      }
      if (bdLines.length > 0) {
        sections.push(`## BD Strategist Insights\n${bdLines.join('\n')}`)
      }
    }

    // Operations insights (Monday)
    if (data.opsInsights) {
      const ops = data.opsInsights
      if (ops.headline) {
        sections.push(`## Operations (Monday)\n${ops.headline}`)
      }
    }

    // Marketing insights (Monday)
    if (data.marketingInsights) {
      const mkt = data.marketingInsights
      if (mkt.headline) {
        sections.push(`## Marketing & Positioning (Monday)\n${mkt.headline}`)
      }
    }

    // Innovation insights (Monday)
    if (data.innovationInsights) {
      const inn = data.innovationInsights
      if (inn.headline) {
        sections.push(`## Innovation (Monday)\n${inn.headline}`)
      }
    }

    // Pattern alerts (Monday)
    if (data.patternAlerts.length > 0) {
      const alertLines = data.patternAlerts.map(a =>
        `- [${a.severity.toUpperCase()}] ${a.title}: ${a.detail}`
      ).join('\n')
      sections.push(`## Pattern Observations\n${alertLines}`)
    }

    // Industry news (Monday)
    if (data.industryNews.length > 0) {
      const news = data.industryNews.map(n => `- ${n.title}: ${n.detail} (${n.source})`).join('\n')
      sections.push(`## Industry News\n${news}`)
    }

    // Coaching highlights (Monday)
    if (data.coachingHighlights.length > 0) {
      const coaching = data.coachingHighlights.map(c =>
        `- "${c.meeting_title}" (${c.meeting_date.split('T')[0]}): ${c.coaching_markdown.slice(0, 200)}`
      ).join('\n')
      sections.push(`## Sales Coaching\n${coaching}`)
    }
  }

  // Agent work queue
  if (data.agentOutputs.length > 0) {
    const outputs = data.agentOutputs
      .map(o => `- [${o.agent_id}/${o.output_type}] ${o.title}: ${o.summary || 'No summary'}`)
      .join('\n')
    sections.push(`## Agent Work for Review\n${outputs}`)
  }

  const dayType = data.isMonday ? 'Monday' : 'daily'
  return `Generate the ${dayType} briefing for ${data.today}.

${sections.join('\n\n')}

Instructions:
- Generate 3-5 tactical_items. Each MUST start with an action verb. Prioritize: (1) things that cost money/reputation if ignored today, (2) deadlines today, (3) someone waiting on a response.
- Use EXACT deal names, dollar amounts, and dates from VERIFIED FACTS. Do not rename "PLG Engagement" to "PLG deal" — use the exact name.
- For transcript-sourced data, note that names may have transcription errors.
- fyi_item: only include if there's something genuinely notable but not actionable. Otherwise null.
${data.isMonday ? `- This is MONDAY: generate 3-5 strategic_items covering financial health, pipeline status, Rock progress, and any positioning/pattern signals. Use exact metrics from VERIFIED FACTS.` : `- This is NOT Monday: strategic_items MUST be an empty array [].`}`
}
