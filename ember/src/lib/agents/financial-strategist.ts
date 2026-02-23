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

// Thresholds from agent definition config
const THRESHOLDS = {
  minMarginPct: 30,
  maxArDays: 45,
  maxConcentrationPct: 60,
}

const financialAnalysisSchema = z.object({
  headline: z.string().describe('One-line financial headline for the briefing, e.g. "Cash flow healthy but AR aging on 2 clients needs attention"'),

  summary: z.string().describe('2-3 sentence executive summary of financial health with specific dollar amounts'),

  margin_analysis: z.array(z.object({
    client_name: z.string(),
    revenue: z.number(),
    estimated_margin_pct: z.number(),
    trend: z.enum(['improving', 'stable', 'declining']),
    trend_indicator: z.string().describe('↑ ↓ or → indicating week-over-week direction'),
    wow_change_pct: z.number().nullable().describe('Week-over-week change in margin percentage, null if no prior data'),
    note: z.string().describe('Brief insight about this client margin with specific dollar amounts'),
  })).describe('Margin by client analysis'),

  ar_aging_alerts: z.array(z.object({
    client_name: z.string(),
    amount_due: z.number(),
    days_outstanding: z.number(),
    risk_level: z.enum(['low', 'medium', 'high', 'critical']).describe('low: <30d, medium: 30-45d, high: 45-60d, critical: >60d'),
    recommendation: z.string().describe('Specific next step with owner name if applicable'),
  })).describe('AR aging alerts for overdue invoices'),

  cash_flow_assessment: z.object({
    total_receivable: z.number(),
    total_recent_payments: z.number(),
    net_position: z.enum(['healthy', 'watch', 'concern']),
    runway_note: z.string().describe('How many weeks/months of runway at current burn, or general cash position note'),
    trend_indicator: z.string().describe('↑ ↓ or → indicating week-over-week direction'),
    note: z.string(),
  }).describe('Cash flow health assessment'),

  concentration_risk: z.object({
    top_client_name: z.string(),
    top_client_pct: z.number(),
    is_above_threshold: z.boolean(),
    trend_indicator: z.string().describe('↑ ↓ or → indicating whether concentration is improving or worsening'),
    recommendation: z.string(),
  }).describe('Revenue concentration risk analysis'),

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
  // Gather financial data
  const [invoiceData, paymentData, reportData, scorecardData, existingIssues] = await Promise.all([
    getFinancialData(organizationId, 'invoice'),
    getFinancialData(organizationId, 'payment'),
    getFinancialData(organizationId, 'financial_report'),
    getScorecardMetrics(organizationId),
    getExistingFinancialIssues(organizationId),
  ])

  // Build prompt
  const prompt = buildAnalysisPrompt(invoiceData, paymentData, reportData, scorecardData, existingIssues)

  // Generate structured analysis
  const { object: analysis } = await generateObject({
    model: anthropic(process.env.AGENT_DEFAULT_MODEL || 'claude-sonnet-4-20250514'),
    schema: financialAnalysisSchema,
    prompt,
    system: `You are the Financial Strategist for Caldera, a 14-person software services company.

Key context:
- ~73% revenue from single anchor client ($1.8M). Diversification is critical.
- Shifting from T&M billing to value-based fixed-fee engagements.
- Three partners: Rich (CEO/CFO), John (Sales), Wade (Ops/Engineering).
- Thresholds: margin < ${THRESHOLDS.minMarginPct}% triggers alert, AR > ${THRESHOLDS.maxArDays} days triggers alert, concentration > ${THRESHOLDS.maxConcentrationPct}% triggers alert.

Analyze the provided financial data and produce actionable insights. Every finding should map to an EOS construct (Issue for L10, Scorecard metric, or Rock recommendation). Be specific with numbers — no vague observations.

If no financial data is available, still provide assessment based on any available scorecard metrics or note that financial data ingestion needs to be configured.`,
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
    .select('title, goal, owner_id')
    .eq('organization_id', organizationId)

  return data || []
}

async function getExistingFinancialIssues(organizationId: string) {
  const { data } = await supabaseAdmin
    .from('issues')
    .select('title, status, created_at')
    .eq('organization_id', organizationId)
    .eq('status', 'open')
    .ilike('title', '%financial%')
    .limit(10)

  return data || []
}

function buildAnalysisPrompt(
  invoices: Array<{ payload: Record<string, unknown>; source_timestamp: string }>,
  payments: Array<{ payload: Record<string, unknown>; source_timestamp: string }>,
  reports: Array<{ payload: Record<string, unknown>; source_timestamp: string }>,
  metrics: Array<{ title: string; goal: string | null; owner_id: string }>,
  existingIssues: Array<{ title: string; status: string; created_at: string }>,
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

  if (metrics.length > 0) {
    sections.push(`### Scorecard Metrics (${metrics.length})`)
    sections.push(JSON.stringify(metrics, null, 2))
  }

  if (existingIssues.length > 0) {
    sections.push(`### Existing Financial Issues (${existingIssues.length})`)
    sections.push(JSON.stringify(existingIssues, null, 2))
    sections.push('Note: Do not duplicate existing issues. Reference them if relevant.')
  }

  sections.push('\nAnalyze this data and produce your financial assessment.')

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
    priority: 'high',
    created_by: null, // System-generated
  })
}
