import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { saveAgentOutput } from './agent-runtime'
import { fetchIndustryNews } from '@/lib/connectors/brave-search-client'
import type { AgentOutputInsert } from '@/types/agents'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================
// Schema
// ============================================

const innovationAnalysisSchema = z.object({
  headline: z.string().describe('One-line summary of most notable signal this cycle, e.g. "CrewAI raised $50M — AI agent orchestration market accelerating faster than expected"'),

  technology_trends: z.array(z.object({
    trend: z.string(),
    relevance: z.number().min(1).max(10).describe('Relevance to Caldera (1-10)'),
    capability_match: z.string().describe('How this maps to existing Caldera capabilities'),
    opportunity_type: z.enum(['build', 'enhance_delivery', 'new_offering', 'defensive']),
    time_horizon: z.enum(['now', '6_months', '12_plus_months']),
    source_url: z.string().nullable().describe('URL source if from web search'),
  })).describe('Technology trends relevant to Caldera'),

  market_signals: z.array(z.object({
    signal: z.string(),
    source: z.string(),
    relevance_to_caldera: z.string(),
    what_it_means: z.string().describe('Implication for Caldera'),
  })).describe('Market signals worth tracking'),

  competitor_product_moves: z.array(z.object({
    competitor: z.string(),
    what_they_did: z.string().describe('What they launched, announced, or changed'),
    implication_for_caldera: z.string(),
  })).describe('Competitor product/service launches and announcements'),

  opportunity_seeds: z.array(z.object({
    idea: z.string(),
    origin: z.enum(['client_pattern', 'market_trend', 'tech_capability']),
    potential: z.string().describe('Brief potential assessment'),
    next_step_to_validate: z.string().describe('One concrete step to test this idea'),
  })).describe('Raw opportunity ideas for leadership consideration — lightweight, not full business cases'),

  bench_time_signals: z.object({
    context: z.string().describe('Current utilization and bench time context from financial data'),
    suggested_focus: z.array(z.string()).describe('1-3 focus areas for bench time based on current trends'),
  }),

  eos_actions: z.array(z.object({
    type: z.enum(['create_issue', 'create_todo']),
    title: z.string(),
    detail: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    owner_hint: z.string().describe('Suggested owner: Rich, John, or Wade'),
  })).describe('Recommended EOS actions'),
})

type InnovationAnalysis = z.infer<typeof innovationAnalysisSchema>

// ============================================
// Main entry point
// ============================================

/**
 * Run weekly innovation analysis.
 * Continuous market radar: surfaces trends, signals, and opportunities for leadership consideration.
 */
export async function runInnovationAnalysis(organizationId: string): Promise<{
  analysis: InnovationAnalysis
  outputsCreated: number
  issuesCreated: number
}> {
  const [techTrends, competitorProductNews, clientPatterns, benchTimeData, existingIssues] = await Promise.all([
    getTechTrends(),
    getCompetitorProductNews(),
    getClientPatterns(organizationId),
    getBenchTimeData(organizationId),
    getExistingInnovationIssues(organizationId),
  ])

  const prompt = buildAnalysisPrompt(techTrends, competitorProductNews, clientPatterns, benchTimeData, existingIssues)

  const { object: analysis } = await generateObject({
    model: anthropic(process.env.AGENT_DEFAULT_MODEL || 'claude-sonnet-4-20250514'),
    schema: innovationAnalysisSchema,
    prompt,
    system: SYSTEM_PROMPT,
  })

  // Save main analysis
  const mainOutput: AgentOutputInsert = {
    organization_id: organizationId,
    agent_id: 'product-innovation',
    output_type: 'analysis',
    title: `Innovation Analysis — ${new Date().toISOString().split('T')[0]}`,
    summary: analysis.headline,
    content: analysis as unknown as Record<string, unknown>,
    trust_zone: 1,
    status: 'completed',
  }
  await saveAgentOutput(mainOutput)

  let issuesCreated = 0
  let outputsCreated = 1

  // Auto-create Issues for defensive trends that need immediate attention
  for (const trend of analysis.technology_trends) {
    if (trend.opportunity_type === 'defensive' && trend.relevance >= 8 && trend.time_horizon === 'now') {
      await createInnovationIssue(
        organizationId,
        `Defensive Alert: ${trend.trend}`,
        `Relevance: ${trend.relevance}/10. ${trend.capability_match}`,
      )
      issuesCreated++
    }
  }

  // Save EOS action recommendations as pending_review
  for (const action of analysis.eos_actions) {
    const actionOutput: AgentOutputInsert = {
      organization_id: organizationId,
      agent_id: 'product-innovation',
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

// ============================================
// System prompt
// ============================================

const SYSTEM_PROMPT = `You are the Product Innovation Officer for Caldera, a 14-person AI-powered product consultancy.

## Your Role
You are a continuous market radar and idea processor. You do NOT make product decisions or prescribe strategy. You surface emerging trends, market signals, and raw opportunities for the leadership team to evaluate. Your job is to ensure the team never misses a signal worth discussing.

## Caldera Context
- 14-person software consultancy (~$2.5M revenue, 3 partners)
- 73% revenue concentration in one anchor client — diversification is existential
- Repositioning from "dev services" to "AI-powered product consultancy"
- Cash-critical Q1 2026 — burning $64-80K/month
- Building Ember (this platform) as an internal AI operations system
- Strong capabilities in: AI agent orchestration, full-lifecycle product development, design + engineering

## Cash-Critical Filter
Every signal should pass this filter: "Does this generate revenue within 6 months or position for $20M exit within 3 years?" If neither, flag it as interesting but low priority.

## Known Strategic Context (don't re-analyze weekly)
- AI Assessment Accelerator is the #1 productization opportunity (already being built for Pivotal)
- Ember as a product is the #2 long-term bet (275K+ EOS companies, Ninety.io at $30M ARR proves market)
- Agent orchestration is Caldera's strongest capability match (10/10 relevance)

## Monitoring Priorities
- AI agent orchestration frameworks (LangGraph, CrewAI, Claude tools, MCP)
- No-code/low-code AI platforms (Langflow, n8n, Flowise) — DEFENSIVE, these erode bottom of market
- EOS ecosystem tools (Ninety.io, Bloom Growth, EOS One, Strety)
- Enterprise AI adoption patterns (Gartner, Forrester)
- Vertical AI applications in industries Caldera serves (QSR, healthcare, fintech)
- Competitor product launches (Blank Metal, Livefront)

## Output Philosophy
- Surface signals, don't prescribe strategy
- Keep opportunity_seeds lightweight — a sentence, not a business plan
- Focus on what's NEW or CHANGED this week, not static market descriptions
- Be honest about what matters vs. what's noise
- Connect trends to Caldera's actual capabilities and current situation`

// ============================================
// Data fetching
// ============================================

async function getTechTrends() {
  return fetchIndustryNews([
    'AI agent orchestration framework launches 2026',
    'enterprise AI adoption trends consulting services',
    'no-code AI platform low-code workflow automation 2026',
  ])
}

async function getCompetitorProductNews() {
  return fetchIndustryNews([
    'Blank Metal AI engineering product launch',
    'Ninety.io EOS software AI features update',
    'AI product consultancy services company news',
  ])
}

async function getClientPatterns(organizationId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabaseAdmin
    .from('ingested_data')
    .select('payload, source_timestamp')
    .eq('organization_id', organizationId)
    .eq('source', 'grain')
    .eq('data_type', 'transcript_summary')
    .gte('source_timestamp', thirtyDaysAgo)
    .order('source_timestamp', { ascending: false })
    .limit(15)

  return data || []
}

async function getBenchTimeData(organizationId: string) {
  // Get Financial Strategist analysis for utilization data
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabaseAdmin
    .from('agent_outputs')
    .select('content')
    .eq('organization_id', organizationId)
    .eq('agent_id', 'financial-strategist')
    .eq('output_type', 'analysis')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!data || data.length === 0) return null
  return data[0].content as Record<string, unknown>
}

async function getExistingInnovationIssues(organizationId: string) {
  const { data } = await supabaseAdmin
    .from('issues')
    .select('title, status, created_at')
    .eq('organization_id', organizationId)
    .eq('status', 'open')
    .or('title.ilike.%product%,title.ilike.%innovation%,title.ilike.%ember%,title.ilike.%defensive%')
    .limit(10)

  return data || []
}

// ============================================
// Prompt builder
// ============================================

function buildAnalysisPrompt(
  techTrends: Array<{ title: string; detail: string; source: string }>,
  competitorNews: Array<{ title: string; detail: string; source: string }>,
  clientPatterns: Array<{ payload: Record<string, unknown>; source_timestamp: string }>,
  benchTimeData: Record<string, unknown> | null,
  existingIssues: Array<{ title: string; status: string; created_at: string }>,
): string {
  const sections: string[] = []

  // Tech trends from web search
  if (techTrends.length > 0) {
    sections.push(`## Technology Trends (${techTrends.length} items from web search)`)
    sections.push(JSON.stringify(techTrends, null, 2))
  } else {
    sections.push('## Technology Trends: No web search results available. Brave Search API may not be configured.')
  }

  // Competitor product news
  if (competitorNews.length > 0) {
    sections.push(`## Competitor Product News (${competitorNews.length} items)`)
    sections.push(JSON.stringify(competitorNews, null, 2))
  } else {
    sections.push('## Competitor News: No results this cycle.')
  }

  // Client patterns from transcripts
  if (clientPatterns.length > 0) {
    sections.push(`## Client Meeting Patterns (${clientPatterns.length} transcripts, last 30 days)`)
    sections.push('Look for recurring needs, repeated requests, pain points that could become products or service offerings.')
    sections.push(JSON.stringify(clientPatterns.map(t => ({
      meeting_title: t.payload.meeting_title,
      summary: t.payload.summary,
      key_points: t.payload.key_points,
      date: t.source_timestamp,
    })), null, 2))
  }

  // Bench time / utilization context
  if (benchTimeData) {
    sections.push('## Financial Context (from Financial Strategist)')
    const utilization = benchTimeData.utilization_metrics || benchTimeData.team_utilization
    if (utilization) {
      sections.push(JSON.stringify(utilization, null, 2))
    } else {
      sections.push(JSON.stringify({ headline: benchTimeData.headline, summary: benchTimeData.summary }, null, 2))
    }
  }

  // Existing issues
  if (existingIssues.length > 0) {
    sections.push(`## Existing Innovation Issues (${existingIssues.length})`)
    sections.push(JSON.stringify(existingIssues, null, 2))
    sections.push('Do not duplicate existing issues.')
  }

  sections.push('\nAnalyze this data as a market radar. Focus on what\'s new, what changed, and what signals are worth the leadership team\'s attention this week.')

  return sections.join('\n\n')
}

// ============================================
// Issue creation (with duplicate check)
// ============================================

async function createInnovationIssue(
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
    description: `[Auto-generated by Product Innovation Officer]\n\n${detail}`,
    status: 'open',
    priority: 'high',
    created_by: null,
  })
}
