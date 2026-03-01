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
  closeOrKillDays: 90,
  targetPipelineCoverage: 4,
  minPipelineCoverage: 2,
  targetWinRate: 35,
  targetDealSize: 30000,
  minFireScore: 40,
  targetActiveDeals: 8,
  minActiveDeals: 4,
  targetSalesCycleDays: 35,
  maxSalesCycleDays: 60,
}

const pipelineAnalysisSchema = z.object({
  headline: z.string().describe('One-line pipeline summary, e.g. "Pipeline at $1.2M across 8 deals — 2 stalled, 1 closing Friday"'),

  pipeline_health: z.object({
    total_value: z.number(),
    deal_count: z.number(),
    qualified_deal_count: z.number().describe('Deals scoring >60 FIRE with activity in last 14 days'),
    avg_deal_size: z.number(),
    avg_days_in_pipeline: z.number(),
    pipeline_coverage_ratio: z.number().describe('Total qualified pipeline ÷ quarterly revenue target. Target: 4x, critical below 2x.'),
    pipeline_velocity: z.number().nullable().describe('(# qualified deals × avg deal size × win rate) ÷ avg cycle length = $ per day in revenue generation capacity'),
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
    fire_score: z.object({
      fit: z.number().describe('0-25: product need alignment'),
      impact: z.number().describe('0-25: revenue potential ($30K+/mo=25, $15-30K=20, $5-15K=15, <$5K=5)'),
      readiness: z.number().describe('0-25: decision-maker + timeline'),
      expansion: z.number().describe('0-25: land-and-expand potential'),
      diversification_bonus: z.number().describe('-5 to +10 based on industry concentration'),
      total: z.number(),
    }).describe('FIRE qualification score for deal prioritization'),
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
    pricing_model: z.enum(['fixed_fee', 'retainer', 'assessment', 'advisory', 't_and_m', 'unknown']).describe('Target pricing model for this deal'),
    confidence_note: z.string().describe('Assessment of close likelihood based on available data'),
  })).describe('Deals with close date within 7 days'),

  diversification_tracker: z.object({
    non_anchor_revenue_pct: z.number().describe('Non-Church\'s revenue as % of total. Current: ~27%, target: 50% by Q4.'),
    mobe_replacement_needed: z.number().describe('Monthly revenue needed to replace MOBE gap ($40K/month after June)'),
    active_client_count: z.number().describe('Clients generating >$10K/month. Target: 5+ by year-end.'),
    pipeline_from_new_sources_pct: z.number().describe('% of pipeline from non-Church\'s prospects'),
    blank_metal_channel_note: z.string().describe('Blank Metal referral pipeline status and any new opportunities'),
  }).describe('Revenue diversification progress tracking'),

  competitive_signals: z.array(z.object({
    deal_name: z.string(),
    competitor: z.string(),
    signal: z.string().describe('What was mentioned or observed about the competitor'),
    response_playbook: z.string().describe('Recommended competitive response based on Caldera positioning'),
  })).describe('Competitive intelligence from transcripts and deal notes'),

  pricing_signals: z.array(z.object({
    deal_name: z.string(),
    signal_type: z.enum(['positive', 'negative']),
    signal: z.string().describe('Pricing-related language from prospect conversations'),
    recommendation: z.string(),
  })).describe('Pricing signals detected from sales conversations'),

  win_loss_summary: z.object({
    recent_wins: z.array(z.object({
      deal_name: z.string(),
      amount: z.number(),
      source: z.enum(['referral', 'inbound', 'partner', 'cold', 'unknown']),
      note: z.string(),
    })),
    recent_losses: z.array(z.object({
      deal_name: z.string(),
      amount: z.number(),
      loss_factor: z.string().describe('Primary reason: price, timing, competitor, scope mismatch, no budget, internal build, etc.'),
      note: z.string(),
    })),
    pattern_insight: z.string().nullable().describe('Any pattern observed in recent wins/losses'),
  }).describe('Recent closed deals and patterns'),

  coaching_themes: z.array(z.object({
    theme: z.string().describe('e.g. "pricing confidence", "multi-threading", "follow-up discipline"'),
    observation: z.string(),
    suggested_improvement: z.string(),
  })).describe('Sales coaching themes from recent call analysis'),

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
  const [dealData, salesTranscripts, existingIssues, coachingFeedback] = await Promise.all([
    getDealData(organizationId),
    getSalesTranscripts(organizationId),
    getExistingPipelineIssues(organizationId),
    getRecentCoaching(organizationId),
  ])

  const prompt = buildAnalysisPrompt(dealData, salesTranscripts, existingIssues, coachingFeedback)

  const { object: analysis } = await generateObject({
    model: anthropic(process.env.AGENT_DEFAULT_MODEL || 'claude-sonnet-4-20250514'),
    schema: pipelineAnalysisSchema,
    prompt,
    system: `You are the BD Strategist for Caldera, a 14-person AI-powered product consultancy.

PERSONALITY: Direct, numbers-driven, action-oriented. John (Sales Partner) is your primary consumer. Lead with the number, then the context. No fluff.

COMPANY CONTEXT:
- ~$2.5M revenue, 73% from Church's ($1.8M/year). Diversification is existential.
- MOBE (~$480K/year) likely ending after June 2026 — $40K/month revenue cliff to replace.
- Repositioning from "dev services" to "AI-powered product consultancy that designs, builds, and accelerates digital products."
- Three partners: John (Sales — your primary consumer), Rich (CEO/CFO), Wade (Ops/Engineering).
- John handles ALL sales solo. Every hour on a low-probability opportunity is an hour lost.
- Blank Metal is co-opetition: competitor AND referral partner. Never badmouth. Track separately.
- Current sales state score: 4/10. Strong relationship-building, weak systematic pipeline management.

DEAL QUALIFICATION — THE FIRE SCORE (0-100, +bonus):
Score every opportunity before John invests >30 minutes:
- F (Fit, 0-25): Has existing product needing evolution (25) → needs new product build (20) → needs AI applied (20) → exploring options (5) → wants staff aug (0 — instant disqualify)
- I (Impact, 0-25): >$30K/mo (25) → $15-30K (20) → $5-15K (15) → <$5K (5) → <$25K one-time (3)
- R (Readiness, 0-25): Decision-maker on call + <30d timeline (25) → DM identified + 30-60d (20) → champion needs approval (15) → no DM (5) → committee no champion (0)
- E (Expansion, 0-25): Clear phase 2+ path (25) → adjacent opps visible (20) → retainer potential (15) → one-and-done (5) → price-shopping 5+ vendors (0)
- Diversification bonus: <10% industry concentration (+10), 10-25% (+5), 25-50% (0), >50% (-5)

SCORING ACTIONS:
- 80-100: PURSUE AGGRESSIVELY — fast-track proposal, up to 10hrs pre-close
- 60-79: PURSUE — standard process, 2-3 calls, up to 5hrs
- 40-59: QUALIFY FURTHER — one more call, 2-week deadline, max 2hrs
- 20-39: NURTURE ONLY — quarterly check-in, 15min/quarter
- 0-19: DISQUALIFY — polite decline, refer if appropriate

INSTANT DISQUALIFIERS:
1. Wants hourly staff augmentation only
2. No budget conversation within first 2 calls
3. Requires 100% on-site presence
4. Decision timeline >6 months
5. Primary need is "cheap offshore alternative"
6. Pure maintenance/support with no product evolution

PIPELINE METRICS & TARGETS:
- Stalled deal threshold: ${THRESHOLDS.stalledDays} days without activity
- Close-or-kill threshold: ${THRESHOLDS.closeOrKillDays} days old
- Pipeline coverage: target ${THRESHOLDS.targetPipelineCoverage}x quarterly target, critical below ${THRESHOLDS.minPipelineCoverage}x
- Active qualified deals: target ${THRESHOLDS.targetActiveDeals}, critical below ${THRESHOLDS.minActiveDeals}
- Target deal size: $${THRESHOLDS.targetDealSize.toLocaleString()}/month
- Target win rate (qualified): ${THRESHOLDS.targetWinRate}%
- Target sales cycle: ${THRESHOLDS.targetSalesCycleDays} days (max ${THRESHOLDS.maxSalesCycleDays})
- Pipeline velocity = (# qualified × avg size × win rate) ÷ avg cycle = $/day revenue generation capacity

PRICING FRAMEWORK (push value-based, not hourly):
- AI Assessment Sprint: $15-35K fixed, 60%+ margin (lead magnet → upsell)
- Product Discovery: $25-50K fixed, 50%+ margin
- Product Build (mid-market): $40-75K/month fixed, 40%+ margin (core offering)
- Enterprise Retainer: $75-150K/month capacity, 35%+ margin
- Fractional CTO/AI Advisory: $10-20K/month, 70%+ margin
- Always present 3 options: Starter (1x), Recommended (1.8-2.2x), Premium (2.5-3x)
- Never discount below 30% gross margin. Max discount: 10% for 6+ month commitment.
- If prospect asks for hourly rate: reframe to outcomes. If they insist, quote $200/hr minimum.

PRICING SIGNALS TO DETECT IN TRANSCRIPTS:
- Positive: "What does this typically cost?", "We have budget allocated", "When can you start?"
- Negative: "Just exploring options", "Can you give us an hourly rate to compare?", "Talking to 5 other firms"

COMPETITIVE RESPONSE PLAYBOOK:
- Blank Metal: "Great team — we partner with them. Different strengths." Never compete, complement.
- Livefront/Zeal (300+ people): "If you need a large team, they're a fit. If you need a focused SWAT team with AI-native delivery, that's us."
- Accenture/Deloitte: "Our partners are hands-on in your code, not managing PowerPoint decks. Same caliber, 10x speed."
- Offshore shops: "The real cost is time to market and rework. We've rebuilt three products this year that started offshore."
- Internal build: "Smart long-term. We can get you to market in 90 days, validate, then you hire to maintain."

WHY CALDERA WINS (reinforce these):
1. Relationship trust — every major deal from John's network
2. Wade's technical credibility on sales calls
3. Speed of response — fast start closes deals
4. AI-forward positioning resonates with AI-savvy buyers
5. Adaptability — assessment sprints reduce buyer risk

WHY CALDERA LOSES (watch for these):
1. Price comparison as commodity (hourly rate conversations)
2. No case studies quantifying outcomes
3. Long decision cycles with no nurture system
4. Over-investing in bespoke proposals that don't convert
5. Single-threaded relationships

DIVERSIFICATION TARGETS:
- Church's: cap at 50% by Q4. Non-anchor revenue from 27% to 50%.
- Replace MOBE: need $40K/month new revenue by July.
- Client count >$10K/month: from 2 to 5 by year-end.
- Target segments: Mid-market fixed-fee (35% of revenue), Enterprise retainers (40%), Sprint/assessment (15%), Advisory (10%).

COACHING FOCUS AREAS (from transcript analysis):
1. Price earlier — budget qualification by call 1-2
2. Multi-thread — "Who else should we include in our next conversation?"
3. Create urgency — "We have capacity for March. After that, next opening is May."
4. Quantify value — shift from capability ("great engineers") to impact ("reduced dev time 60%")
5. Follow-up within 24 hours — every time

Be specific with dollar amounts, dates, and deal names. FIRE-score every deal mentioned. Flag diversification impact of every opportunity. If coaching feedback is available, reference specific strengths and areas for improvement.`,
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
    .or('title.ilike.%pipeline%,title.ilike.%deal%,title.ilike.%stalled%,title.ilike.%sales%,title.ilike.%diversification%,title.ilike.%pricing%')
    .limit(15)

  return data || []
}

async function getRecentCoaching(organizationId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabaseAdmin
    .from('ingested_data')
    .select('payload, source_timestamp')
    .eq('organization_id', organizationId)
    .eq('source', 'grain')
    .eq('data_type', 'coaching_feedback')
    .gte('source_timestamp', thirtyDaysAgo)
    .order('source_timestamp', { ascending: false })
    .limit(10)

  return data || []
}

function buildAnalysisPrompt(
  deals: Array<{ payload: Record<string, unknown>; source_timestamp: string }>,
  transcripts: Array<{ payload: Record<string, unknown>; source_timestamp: string }>,
  existingIssues: Array<{ title: string; status: string; created_at: string }>,
  coachingFeedback: Array<{ payload: Record<string, unknown>; source_timestamp: string }>,
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

  if (coachingFeedback.length > 0) {
    sections.push(`### Sales Coaching Feedback (${coachingFeedback.length} calls, last 30 days)`)
    sections.push(JSON.stringify(coachingFeedback.map(c => ({
      meeting_title: c.payload.meeting_title,
      meeting_date: c.payload.meeting_date,
      participants: c.payload.participants,
      // Truncate coaching markdown to keep prompt manageable
      coaching_summary: typeof c.payload.coaching_markdown === 'string'
        ? c.payload.coaching_markdown.slice(0, 1000)
        : '',
    })), null, 2))
  }

  sections.push('\nAnalyze this data and produce your pipeline assessment. FIRE-score all active deals. Compute pipeline velocity and coverage ratio. Track diversification progress against quarterly targets. Flag competitive signals and pricing patterns from transcripts.')

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
    priority: 1,
    created_by: null,
  })
}
