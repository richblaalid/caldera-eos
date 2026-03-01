import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { saveAgentOutput } from './agent-runtime'
import type { AgentOutputInsert } from '@/types/agents'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Thresholds from agent definition config + Cowork Financial Strategy Assessment
const THRESHOLDS = {
  minMarginPct: 30,
  minFixedFeeMarginPct: 35,
  maxArDays: 45,
  maxConcentrationPct: 60,
  minEffectiveHourlyRate: 125,
  targetEffectiveHourlyRate: 175,
  scopeCreepAlertPct: 110,
  scopeCreepEscalatePct: 125,
  maxPartnerTimePct: 15,
  // Cash runway tiers (weeks)
  runwayHealthy: 16,
  runwayWatch: 12,
  runwayConcern: 8,
  runwayWarning: 4,
  // AR collection probability by age
  arProb30Days: 0.95,
  arProb60Days: 0.85,
  arProbOver60Days: 0.65,
}

const financialAnalysisSchema = z.object({
  headline: z.string().describe('One-line financial headline for the briefing, e.g. "Cash flow healthy but AR aging on 2 clients needs attention"'),

  summary: z.string().describe('2-3 sentence executive summary of financial health with specific dollar amounts'),

  health_score: z.object({
    composite: z.number().describe('Weighted composite score 0-100. Weights: runway 25%, revenue 20%, AR 15%, concentration 10%, utilization 10%, margin 10%, pipeline 5%, net cash flow 5%'),
    interpretation: z.enum(['healthy', 'caution', 'concern', 'crisis']).describe('healthy: 80-100, caution: 60-79, concern: 40-59, crisis: <40'),
  }).describe('Overall financial health composite score'),

  margin_analysis: z.array(z.object({
    client_name: z.string(),
    revenue: z.number(),
    estimated_margin_pct: z.number(),
    engagement_type: z.enum(['t_and_m', 'fixed_fee', 'retainer', 'subcontract']).describe('Pricing model for this engagement'),
    effective_hourly_rate: z.number().nullable().describe('Revenue ÷ actual hours worked. Target: $150-200. Below $125 is competing with offshore.'),
    trend: z.enum(['improving', 'stable', 'declining']),
    trend_indicator: z.string().describe('↑ ↓ or → indicating week-over-week direction'),
    wow_change_pct: z.number().nullable().describe('Week-over-week change in margin percentage, null if no prior data'),
    portfolio_classification: z.enum(['star', 'cash_cow', 'question_mark', 'dog']).describe('Star: high margin + growing. Cash Cow: high margin + stable. Question Mark: low margin + growing. Dog: low margin + declining.'),
    note: z.string().describe('Brief insight about this client margin with specific dollar amounts'),
  })).describe('Margin by client analysis with portfolio classification'),

  ar_aging_alerts: z.array(z.object({
    client_name: z.string(),
    amount_due: z.number(),
    days_outstanding: z.number(),
    risk_level: z.enum(['low', 'medium', 'high', 'critical']).describe('low: <30d, medium: 30-45d, high: 45-60d, critical: >60d'),
    collection_probability: z.number().describe('Estimated collection probability: <30d=95%, 30-60d=85%, >60d=65%'),
    payroll_impact: z.string().nullable().describe('If this AR is not collected, impact on payroll coverage. Critical for Church\'s.'),
    recommendation: z.string().describe('Specific next step with owner name if applicable'),
  })).describe('AR aging alerts for overdue invoices'),

  cash_flow_assessment: z.object({
    total_receivable: z.number(),
    total_recent_payments: z.number(),
    estimated_runway_weeks: z.number().nullable().describe('Cash on hand ÷ weekly net burn. Null if cash data unavailable.'),
    runway_tier: z.enum(['healthy', 'watch', 'concern', 'warning', 'crisis']).describe('healthy: >16wk, watch: 12-16, concern: 8-12, warning: 4-8, crisis: <4'),
    payroll_coverage_ratio: z.number().nullable().describe('Cash on hand ÷ next payroll obligation. Must be >1.0. <1.5 is concern.'),
    net_position: z.enum(['healthy', 'watch', 'concern']),
    runway_note: z.string().describe('How many weeks/months of runway at current burn, or general cash position note'),
    trend_indicator: z.string().describe('↑ ↓ or → indicating week-over-week direction'),
    note: z.string(),
  }).describe('Cash flow health assessment with runway model'),

  revenue_forecast: z.object({
    forecast_30d: z.number().describe('30-day revenue forecast (high confidence). Committed revenue × collection probability.'),
    forecast_60d: z.number().describe('60-day revenue forecast (medium confidence). Adds pipeline deals in negotiation/contract at 50-70% weight.'),
    forecast_90d: z.number().describe('90-day revenue forecast (low confidence). Adds pipeline deals in proposal at 30% weight.'),
    scenario_note: z.string().describe('Which scenario (base/downside/upside) actual results most closely match'),
  }).describe('30/60/90 day revenue forecast with scenario tracking'),

  concentration_risk: z.object({
    top_client_name: z.string(),
    top_client_pct: z.number(),
    is_above_threshold: z.boolean(),
    hhi_index: z.number().nullable().describe('Herfindahl-Hirschman Index — sum of squared client share percentages. Current ~5700, target <3000.'),
    new_revenue_needed: z.number().nullable().describe('Dollar amount of new non-anchor revenue needed to hit next concentration milestone'),
    trend_indicator: z.string().describe('↑ ↓ or → indicating whether concentration is improving or worsening'),
    recommendation: z.string(),
  }).describe('Revenue concentration risk analysis with HHI tracking'),

  scope_creep_signals: z.array(z.object({
    client_name: z.string(),
    signal: z.string().describe('e.g. "Hours exceed estimate by 18%", "Change requests without change orders"'),
    impact_estimate: z.string().describe('Estimated dollar impact of the scope creep'),
  })).describe('Scope creep indicators from financial data — hours vs estimates, unbilled work'),

  eos_actions: z.array(z.object({
    type: z.enum(['create_issue', 'update_scorecard']),
    title: z.string(),
    detail: z.string().describe('Include specific data points (dollar amounts, percentages, dates) and recommended next step'),
    priority: z.enum(['high', 'medium', 'low']),
    data_points: z.array(z.string()).describe('Key numbers supporting this action, e.g. ["$45K overdue", "62 days outstanding"]'),
  })).describe('Recommended EOS actions (Issues to create, Scorecard updates)'),
})

type FinancialAnalysis = z.infer<typeof financialAnalysisSchema>

/**
 * Run overnight financial analysis.
 * Queries QuickBooks data from ingested_data, Scorecard metrics, and existing Issues.
 * Produces structured financial insights and auto-creates Issues for threshold breaches.
 */
export async function runFinancialAnalysis(organizationId: string): Promise<{
  analysis: FinancialAnalysis
  outputsCreated: number
  issuesCreated: number
}> {
  // Gather financial data + pipeline for revenue forecasting
  const [invoiceData, paymentData, reportData, scorecardData, existingIssues, pipelineData] = await Promise.all([
    getFinancialData(organizationId, 'invoice'),
    getFinancialData(organizationId, 'payment'),
    getFinancialData(organizationId, 'financial_report'),
    getScorecardMetrics(organizationId),
    getExistingFinancialIssues(organizationId),
    getPipelineData(organizationId),
  ])

  // Build prompt
  const prompt = buildAnalysisPrompt(invoiceData, paymentData, reportData, scorecardData, existingIssues, pipelineData)

  // Generate structured analysis
  const { object: analysis } = await generateObject({
    model: anthropic(process.env.AGENT_DEFAULT_MODEL || 'claude-sonnet-4-20250514'),
    schema: financialAnalysisSchema,
    prompt,
    system: `You are the Financial Strategist for Caldera, a 14-person AI-powered product consultancy.

PERSONALITY: Direct, numbers-first. Rich (CEO/CFO) is your primary consumer. Lead with the number, then the context. Every finding must map to an EOS construct (Issue, Scorecard metric, or Rock recommendation).

COMPANY CONTEXT:
- ~$2.5M revenue. ~73% from anchor client Church's ($1.8M/year, ~$150K/month).
- Church's 2026 SOW includes a 20% reduction clause — could drop to $1.44M ($360K annual hit). Model base case ($1.8M) and downside case ($1.44M).
- MOBE (~$480K/year, ~$40K/month) likely ending after June 2026. This creates a ~$240K H2 revenue cliff.
- Worst-case 2026 revenue: ~$1.88M against $2.1-2.4M cost base — loss year requiring headcount reduction.
- Monthly burn: ~$192-196K (payroll ~$140K + benefits ~$35K + ops ~$17-21K). Weekly burn: ~$44-45K.
- Transitioning from T&M to fixed-fee. Fixed-fee target margin: >${THRESHOLDS.minFixedFeeMarginPct}%. T&M target: >${THRESHOLDS.minMarginPct}%.
- Three partners: Rich (CEO/CFO — your primary consumer), John (Sales), Wade (Ops/Engineering).

KEY THRESHOLDS:
- Gross margin: target 45%, minimum ${THRESHOLDS.minMarginPct}% (T&M), ${THRESHOLDS.minFixedFeeMarginPct}% (fixed-fee)
- Effective hourly rate: target $${THRESHOLDS.targetEffectiveHourlyRate}, alert below $${THRESHOLDS.minEffectiveHourlyRate}
- AR aging: >30d=Watch, >${THRESHOLDS.maxArDays}d=Concern, >60d=Crisis. Church's AR is existential — any delay on $150K/month is a cash flow emergency.
- Cash runway: >${THRESHOLDS.runwayHealthy}wk=Healthy, ${THRESHOLDS.runwayWatch}-${THRESHOLDS.runwayHealthy}=Watch, ${THRESHOLDS.runwayConcern}-${THRESHOLDS.runwayWatch}=Concern, ${THRESHOLDS.runwayWarning}-${THRESHOLDS.runwayConcern}=Warning, <${THRESHOLDS.runwayWarning}=Crisis
- Payroll coverage ratio: <2.0=Watch, <1.5=Concern, <1.0=Crisis (cannot make payroll)
- Concentration: >${THRESHOLDS.maxConcentrationPct}%=Alert. Track HHI index (current ~5700, target <3000). To get from 73% to 50%, need total revenue of $3.6M (+$1.1M new).
- Scope creep: hours >${THRESHOLDS.scopeCreepAlertPct}% of estimate=Alert, >${THRESHOLDS.scopeCreepEscalatePct}%=Escalate. Partner time >${THRESHOLDS.maxPartnerTimePct}% of engagement hours=Alert.

PRICING INTELLIGENCE:
- T&M (enterprise): 30-35% target margin, 25% floor
- Fixed-fee: 40-50% target, 35% floor. If projected margin <35%, don't convert from T&M.
- Sprint/prototype: 45-55% target, 40% floor ($25-50K per 2-week sprint)
- Retainer/fractional: 35-45% target, 30% floor ($75K/month target)
- Red flags: effective hourly rate <$125, scope creep without change order, partner time >15%, client negotiates >10% discount

CLIENT PORTFOLIO CLASSIFICATION (compute for each client):
- Star: high margin (>40%) + growing revenue — invest in relationship
- Cash Cow: high margin (>40%) + stable revenue — maintain, don't over-invest
- Question Mark: low margin (<30%) + growing revenue — fix pricing or increase efficiency
- Dog: low margin (<30%) + declining revenue — exit gracefully or reprice

REVENUE FORECASTING:
- 30-day: committed revenue × collection probability (invoiced <30d: 95%, 30-60d: 85%, >60d: 65%)
- 60-day: add pipeline deals in negotiation/contract at 50-70% weight
- 90-day: add pipeline deals in proposal at 30% weight
- Pipeline coverage target: 3x the revenue gap

CONCENTRATION MILESTONES: <70% by Q2, <60% by Q3, <50% by Q4. Stop escalating at <50%.

FINANCIAL HEALTH SCORECARD (8 metrics, weighted composite 0-100):
1. Cash Runway (25%): >12wk green, 6-12 yellow, <6 red
2. Revenue trailing 30d (20%): >$210K green, $175-210K yellow, <$175K red
3. AR >45d (15%): <$50K green, $50-100K yellow, >$100K red
4. Concentration (10%): <50% green, 50-65% yellow, >65% red
5. Utilization (10%): >85% green, 70-85% yellow, <70% red
6. Gross Margin blended (10%): >40% green, 30-40% yellow, <30% red
7. Pipeline Coverage (5%): >3x green, 2-3x yellow, <2x red
8. Net Cash Flow 30d (5%): positive green, -$10K-$0 yellow, <-$10K red

Be specific with dollar amounts, dates, and client names. If no financial data is available, still provide assessment based on scorecard metrics or note that QuickBooks integration needs configuration.`,
  })

  // Save the main analysis output
  const mainOutput: AgentOutputInsert = {
    organization_id: organizationId,
    agent_id: 'financial-strategist',
    output_type: 'analysis',
    title: `Financial Analysis — ${new Date().toISOString().split('T')[0]}`,
    summary: analysis.summary,
    content: analysis as unknown as Record<string, unknown>,
    trust_zone: 1,
    status: 'completed',
  }
  await saveAgentOutput(mainOutput)

  let issuesCreated = 0
  let outputsCreated = 1

  // Auto-create Issues for threshold breaches (Zone 1 auto-actions)
  for (const arAlert of analysis.ar_aging_alerts) {
    if (arAlert.days_outstanding > THRESHOLDS.maxArDays) {
      await createFinancialIssue(
        organizationId,
        `AR Alert: ${arAlert.client_name} — ${arAlert.days_outstanding} days outstanding ($${arAlert.amount_due.toLocaleString()})`,
        `Risk level: ${arAlert.risk_level.toUpperCase()}\n\n${arAlert.recommendation}`,
      )
      issuesCreated++
    }
  }

  for (const margin of analysis.margin_analysis) {
    if (margin.estimated_margin_pct < THRESHOLDS.minMarginPct) {
      const trendInfo = margin.wow_change_pct !== null
        ? ` (${margin.trend_indicator} ${margin.wow_change_pct > 0 ? '+' : ''}${margin.wow_change_pct}% WoW)`
        : ''
      await createFinancialIssue(
        organizationId,
        `Low Margin Alert: ${margin.client_name} at ${margin.estimated_margin_pct}%${trendInfo}`,
        `Revenue: $${margin.revenue.toLocaleString()} | Trend: ${margin.trend}\n\n${margin.note}`,
      )
      issuesCreated++
    }
  }

  if (analysis.concentration_risk.is_above_threshold) {
    await createFinancialIssue(
      organizationId,
      `Revenue Concentration: ${analysis.concentration_risk.top_client_name} at ${analysis.concentration_risk.top_client_pct}% ${analysis.concentration_risk.trend_indicator}`,
      `Threshold: ${THRESHOLDS.maxConcentrationPct}%\n\n${analysis.concentration_risk.recommendation}`,
    )
    issuesCreated++
  }

  // Save EOS action recommendations as pending_review outputs
  for (const action of analysis.eos_actions) {
    const actionOutput: AgentOutputInsert = {
      organization_id: organizationId,
      agent_id: 'financial-strategist',
      output_type: action.type === 'create_issue' ? 'issue' : 'recommendation',
      title: action.title,
      summary: action.detail,
      content: { type: action.type, priority: action.priority, detail: action.detail, data_points: action.data_points },
      trust_zone: 2,
      status: 'pending_review',
    }
    await saveAgentOutput(actionOutput)
    outputsCreated++
  }

  return { analysis, outputsCreated, issuesCreated }
}

async function getFinancialData(organizationId: string, dataType: string) {
  const { data } = await supabaseAdmin
    .from('ingested_data')
    .select('payload, source_timestamp')
    .eq('organization_id', organizationId)
    .eq('source', 'quickbooks')
    .eq('data_type', dataType)
    .order('source_timestamp', { ascending: false })
    .limit(100)

  return data || []
}

async function getScorecardMetrics(organizationId: string) {
  const { data } = await supabaseAdmin
    .from('scorecard_metrics')
    .select('name, target, owner_id')
    .eq('organization_id', organizationId)

  return data || []
}

async function getExistingFinancialIssues(organizationId: string) {
  const { data } = await supabaseAdmin
    .from('issues')
    .select('title, status, created_at')
    .eq('organization_id', organizationId)
    .eq('status', 'open')
    .or('title.ilike.%financial%,title.ilike.%margin%,title.ilike.%AR Alert%,title.ilike.%concentration%,title.ilike.%cash%,title.ilike.%revenue%,title.ilike.%scope creep%')
    .limit(15)

  return data || []
}

async function getPipelineData(organizationId: string) {
  const { data } = await supabaseAdmin
    .from('ingested_data')
    .select('payload, source_timestamp')
    .eq('organization_id', organizationId)
    .eq('source', 'hubspot')
    .eq('data_type', 'deal')
    .order('source_timestamp', { ascending: false })
    .limit(50)

  return data || []
}

function buildAnalysisPrompt(
  invoices: Array<{ payload: Record<string, unknown>; source_timestamp: string }>,
  payments: Array<{ payload: Record<string, unknown>; source_timestamp: string }>,
  reports: Array<{ payload: Record<string, unknown>; source_timestamp: string }>,
  metrics: Array<{ name: string; target: number | null; owner_id: string }>,
  existingIssues: Array<{ title: string; status: string; created_at: string }>,
  pipeline: Array<{ payload: Record<string, unknown>; source_timestamp: string }>,
): string {
  const sections: string[] = []

  sections.push('## Financial Data Available')

  if (invoices.length > 0) {
    sections.push(`### Invoices (${invoices.length} records, last 90 days)`)
    sections.push(JSON.stringify(invoices.map(i => i.payload), null, 2))
  } else {
    sections.push('### Invoices: No data available')
  }

  if (payments.length > 0) {
    sections.push(`### Payments (${payments.length} records, last 30 days)`)
    sections.push(JSON.stringify(payments.map(p => p.payload), null, 2))
  } else {
    sections.push('### Payments: No data available')
  }

  if (reports.length > 0) {
    sections.push(`### Financial Reports (${reports.length})`)
    sections.push(JSON.stringify(reports.map(r => r.payload), null, 2))
  } else {
    sections.push('### Financial Reports: No data available')
  }

  if (pipeline.length > 0) {
    sections.push(`### Pipeline Data (${pipeline.length} deals from HubSpot)`)
    sections.push('Use for revenue forecasting and pipeline coverage ratio computation.')
    sections.push(JSON.stringify(pipeline.map(d => ({
      deal_name: d.payload.deal_name,
      amount: d.payload.amount,
      stage: d.payload.stage,
      close_date: d.payload.close_date,
    })), null, 2))
  }

  if (metrics.length > 0) {
    sections.push(`### Scorecard Metrics (${metrics.length})`)
    sections.push(JSON.stringify(metrics, null, 2))
  }

  if (existingIssues.length > 0) {
    sections.push(`### Existing Financial Issues (${existingIssues.length})`)
    sections.push(JSON.stringify(existingIssues, null, 2))
    sections.push('Note: Do not duplicate existing issues. Reference them if relevant.')
  }

  sections.push('\nAnalyze this data and produce your financial assessment. Compute the 8-metric health scorecard, classify each client in the portfolio matrix, and generate 30/60/90 day revenue forecasts.')

  return sections.join('\n\n')
}

/**
 * Create an Issue in the issues table (Zone 1 auto-action).
 */
async function createFinancialIssue(
  organizationId: string,
  title: string,
  detail: string,
) {
  // Check for duplicate
  const { data: existing } = await supabaseAdmin
    .from('issues')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('title', title)
    .eq('status', 'open')
    .limit(1)

  if (existing && existing.length > 0) return

  await supabaseAdmin.from('issues').insert({
    organization_id: organizationId,
    title,
    description: `[Auto-generated by Financial Strategist]\n\n${detail}`,
    status: 'open',
    priority: 1,
    created_by: null, // System-generated
  })
}
