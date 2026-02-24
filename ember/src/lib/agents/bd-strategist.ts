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

const THRESHOLDS = {
  stalledDays: 14,
  closingWindowDays: 7,
}

const pipelineAnalysisSchema = z.object({
  headline: z.string().describe('One-line pipeline summary, e.g. "Pipeline at $1.2M across 8 deals — 2 stalled, 1 closing Friday"'),

  pipeline_health: z.object({
    total_value: z.number(),
    deal_count: z.number(),
    avg_deal_size: z.number(),
    avg_days_in_pipeline: z.number(),
    stage_distribution: z.array(z.object({
      stage: z.string(),
      count: z.number(),
      value: z.number(),
    })).describe('Deals grouped by pipeline stage'),
    trend_indicator: z.string().describe('↑ ↓ or → compared to prior period'),
    trend_note: z.string().describe('Brief note on pipeline direction'),
  }),

  deals_at_risk: z.array(z.object({
    deal_name: z.string(),
    amount: z.number(),
    risk_reason: z.string().describe('Why this deal is at risk: stalled, overdue close, competitor, etc.'),
    days_stalled: z.number().nullable(),
    days_past_close: z.number().nullable(),
    recommended_action: z.string(),
  })).describe('Deals needing attention — stalled, overdue, or at risk'),

  closing_this_week: z.array(z.object({
    deal_name: z.string(),
    amount: z.number(),
    close_date: z.string(),
    stage: z.string(),
    confidence_note: z.string().describe('Assessment of close likelihood based on available data'),
  })).describe('Deals with close date within 7 days'),

  win_loss_summary: z.object({
    recent_wins: z.array(z.object({
      deal_name: z.string(),
      amount: z.number(),
      note: z.string(),
    })),
    recent_losses: z.array(z.object({
      deal_name: z.string(),
      amount: z.number(),
      note: z.string(),
    })),
    pattern_insight: z.string().nullable().describe('Any pattern observed in recent wins/losses'),
  }).describe('Recent closed deals and patterns'),

  eos_actions: z.array(z.object({
    type: z.enum(['create_issue', 'create_todo']),
    title: z.string(),
    detail: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    owner_hint: z.string().describe('Suggested owner: Rich, John, or Wade'),
  })).describe('Recommended EOS actions for pipeline risks'),
})

type PipelineAnalysis = z.infer<typeof pipelineAnalysisSchema>

/**
 * Run overnight pipeline analysis.
 * Queries HubSpot deals from ingested_data, recent sales transcripts, and existing Issues.
 * Produces structured pipeline intelligence and auto-creates Issues for at-risk deals.
 */
export async function runPipelineAnalysis(organizationId: string): Promise<{
  analysis: PipelineAnalysis
  outputsCreated: number
  issuesCreated: number
}> {
  const [dealData, salesTranscripts, existingIssues] = await Promise.all([
    getDealData(organizationId),
    getSalesTranscripts(organizationId),
    getExistingPipelineIssues(organizationId),
  ])

  const prompt = buildAnalysisPrompt(dealData, salesTranscripts, existingIssues)

  const { object: analysis } = await generateObject({
    model: anthropic(process.env.AGENT_DEFAULT_MODEL || 'claude-sonnet-4-20250514'),
    schema: pipelineAnalysisSchema,
    prompt,
    system: `You are the BD Strategist for Caldera, a 14-person software services company.

Key context:
- ~73% revenue from single anchor client. Diversification is existential priority.
- Repositioning from "dev services" to "AI-powered product consultancy"
- Three partners: John (Sales — your primary consumer), Rich (CEO/CFO), Wade (Ops/Engineering)
- HubSpot is the CRM. All deal data comes from there.
- Stalled deal threshold: ${THRESHOLDS.stalledDays} days without activity
- Closing window: deals within ${THRESHOLDS.closingWindowDays} days of close date

Analyze the pipeline data and produce actionable intelligence. Focus on:
1. Which deals need immediate attention (stalled, overdue, at risk)
2. What's closing soon and how confident we should be
3. Pipeline health trends — is it growing or shrinking?
4. Patterns from wins/losses that inform strategy

Be specific with dollar amounts, dates, and deal names. John has zero patience for fluff.
If no deal data is available, note that HubSpot integration needs to be configured.`,
  })

  // Save main analysis
  const mainOutput: AgentOutputInsert = {
    organization_id: organizationId,
    agent_id: 'bd-strategist',
    output_type: 'analysis',
    title: `Pipeline Analysis — ${new Date().toISOString().split('T')[0]}`,
    summary: analysis.headline,
    content: analysis as unknown as Record<string, unknown>,
    trust_zone: 1,
    status: 'completed',
  }
  await saveAgentOutput(mainOutput)

  let issuesCreated = 0
  let outputsCreated = 1

  // Auto-create Issues for at-risk deals (Zone 1)
  for (const deal of analysis.deals_at_risk) {
    if ((deal.days_stalled && deal.days_stalled >= THRESHOLDS.stalledDays) ||
        (deal.days_past_close && deal.days_past_close > 0)) {
      await createPipelineIssue(
        organizationId,
        `Pipeline Risk: ${deal.deal_name} — $${deal.amount.toLocaleString()} (${deal.risk_reason})`,
        `${deal.recommended_action}`,
      )
      issuesCreated++
    }
  }

  // Save EOS action recommendations as pending_review
  for (const action of analysis.eos_actions) {
    const actionOutput: AgentOutputInsert = {
      organization_id: organizationId,
      agent_id: 'bd-strategist',
      output_type: action.type === 'create_issue' ? 'issue' : 'recommendation',
      title: action.title,
      summary: action.detail,
      content: { type: action.type, priority: action.priority, detail: action.detail, owner_hint: action.owner_hint },
      trust_zone: 2,
      status: 'pending_review',
    }
    await saveAgentOutput(actionOutput)
    outputsCreated++
  }

  return { analysis, outputsCreated, issuesCreated }
}

async function getDealData(organizationId: string) {
  const { data } = await supabaseAdmin
    .from('ingested_data')
    .select('payload, source_timestamp')
    .eq('organization_id', organizationId)
    .eq('source', 'hubspot')
    .eq('data_type', 'deal')
    .order('source_timestamp', { ascending: false })
    .limit(100)

  return data || []
}

async function getSalesTranscripts(organizationId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabaseAdmin
    .from('ingested_data')
    .select('payload, source_timestamp')
    .eq('organization_id', organizationId)
    .eq('source', 'grain')
    .eq('data_type', 'transcript_summary')
    .contains('relevance_tags', ['sales'])
    .gte('source_timestamp', thirtyDaysAgo)
    .order('source_timestamp', { ascending: false })
    .limit(10)

  return data || []
}

async function getExistingPipelineIssues(organizationId: string) {
  const { data } = await supabaseAdmin
    .from('issues')
    .select('title, status, created_at')
    .eq('organization_id', organizationId)
    .eq('status', 'open')
    .or('title.ilike.%pipeline%,title.ilike.%deal%,title.ilike.%stalled%')
    .limit(10)

  return data || []
}

function buildAnalysisPrompt(
  deals: Array<{ payload: Record<string, unknown>; source_timestamp: string }>,
  transcripts: Array<{ payload: Record<string, unknown>; source_timestamp: string }>,
  existingIssues: Array<{ title: string; status: string; created_at: string }>,
): string {
  const sections: string[] = []

  sections.push('## Pipeline Data')

  if (deals.length > 0) {
    sections.push(`### Active Deals (${deals.length})`)
    sections.push(JSON.stringify(deals.map(d => d.payload), null, 2))
  } else {
    sections.push('### Deals: No data available (HubSpot integration may not be configured)')
  }

  if (transcripts.length > 0) {
    sections.push(`### Recent Sales Meeting Transcripts (${transcripts.length}, last 30 days)`)
    sections.push(JSON.stringify(transcripts.map(t => ({
      meeting_title: t.payload.meeting_title,
      meeting_type: t.payload.meeting_type,
      key_points: t.payload.key_points,
      action_items: t.payload.action_items,
      decisions: t.payload.decisions,
      date: t.source_timestamp,
    })), null, 2))
  }

  if (existingIssues.length > 0) {
    sections.push(`### Existing Pipeline Issues (${existingIssues.length})`)
    sections.push(JSON.stringify(existingIssues, null, 2))
    sections.push('Note: Do not duplicate existing issues. Reference them if relevant.')
  }

  sections.push('\nAnalyze this data and produce your pipeline assessment.')

  return sections.join('\n\n')
}

async function createPipelineIssue(
  organizationId: string,
  title: string,
  detail: string,
) {
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
    description: `[Auto-generated by BD Strategist]\n\n${detail}`,
    status: 'open',
    priority: 'high',
    created_by: null,
  })
}
