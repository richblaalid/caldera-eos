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

const marketingAnalysisSchema = z.object({
  headline: z.string().describe('One-line positioning summary, e.g. "Positioning score 4/10 — Blank Metal launched newsletter, Caldera still has zero published case studies"'),

  positioning_score: z.object({
    score: z.number().min(1).max(10).describe('1-10 score for current positioning progress toward "AI-powered product consultancy"'),
    rationale: z.string().describe('Why this score — what changed since baseline of 3/10 in Feb 2026'),
  }),

  competitive_landscape: z.array(z.object({
    competitor: z.string(),
    positioning: z.string().describe('Their current positioning in the market'),
    threat_level: z.enum(['low', 'medium', 'high']),
    caldera_differentiator: z.string().describe('What makes Caldera different from this competitor'),
    notable_activity: z.string().nullable().describe('Any recent activity: hiring, partnerships, content, product launches'),
  })).describe('Key competitors and their positioning'),

  positioning_assessment: z.object({
    current: z.string().describe('Where Caldera is positioned today'),
    target: z.string().describe('Where Caldera should be positioned'),
    gaps: z.array(z.string()).describe('Specific gaps between current and target'),
    progress_notes: z.string().describe('What has improved or regressed since last analysis'),
  }),

  content_opportunities: z.array(z.object({
    topic: z.string(),
    rationale: z.string().describe('Why this content matters for diversification'),
    format: z.enum(['blog', 'case_study', 'linkedin', 'newsletter', 'video', 'whitepaper']),
    priority: z.enum(['high', 'medium', 'low']),
    effort_level: z.enum(['low', 'medium', 'high']),
    diversification_impact: z.string().describe('How this helps reduce revenue concentration'),
  })).describe('Content opportunities ranked by priority'),

  client_language_insights: z.array(z.object({
    pattern: z.string().describe('The language pattern observed'),
    sentiment: z.enum(['red_flag', 'green_flag']).describe('red_flag = T&M mindset, green_flag = value-buyer mindset'),
    source_meeting: z.string().describe('Which meeting or transcript this came from'),
    how_to_leverage: z.string().describe('How to use this insight in marketing or sales'),
  })).describe('Client language patterns from transcript analysis'),

  market_signals: z.array(z.object({
    trend: z.string(),
    relevance_to_caldera: z.string(),
    recommended_action: z.string(),
  })).describe('Market trends relevant to Caldera'),

  eos_actions: z.array(z.object({
    type: z.enum(['create_issue', 'create_todo']),
    title: z.string(),
    detail: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    owner_hint: z.string().describe('Suggested owner: Rich, John, or Wade'),
  })).describe('Recommended EOS actions for marketing improvements'),
})

type MarketingAnalysis = z.infer<typeof marketingAnalysisSchema>

// ============================================
// Main entry point
// ============================================

/**
 * Run weekly marketing analysis.
 * Analyzes competitive landscape, client language patterns, and positioning progress.
 */
export async function runMarketingAnalysis(organizationId: string): Promise<{
  analysis: MarketingAnalysis
  outputsCreated: number
  issuesCreated: number
}> {
  const [clientTranscripts, competitorNews, dealNarratives, existingIssues] = await Promise.all([
    getClientTranscripts(organizationId),
    getCompetitorNews(),
    getDealNarratives(organizationId),
    getExistingMarketingIssues(organizationId),
  ])

  const prompt = buildAnalysisPrompt(clientTranscripts, competitorNews, dealNarratives, existingIssues)

  const { object: analysis } = await generateObject({
    model: anthropic(process.env.AGENT_DEFAULT_MODEL || 'claude-sonnet-4-20250514'),
    schema: marketingAnalysisSchema,
    prompt,
    system: SYSTEM_PROMPT,
  })

  // Save main analysis
  const mainOutput: AgentOutputInsert = {
    organization_id: organizationId,
    agent_id: 'marketing-strategist',
    output_type: 'analysis',
    title: `Marketing Analysis — ${new Date().toISOString().split('T')[0]}`,
    summary: analysis.headline,
    content: analysis as unknown as Record<string, unknown>,
    trust_zone: 1,
    status: 'completed',
  }
  await saveAgentOutput(mainOutput)

  let issuesCreated = 0
  let outputsCreated = 1

  // Auto-create Issues for high-priority positioning gaps and competitive threats
  for (const competitor of analysis.competitive_landscape) {
    if (competitor.threat_level === 'high' && competitor.notable_activity) {
      await createMarketingIssue(
        organizationId,
        `Competitive Alert: ${competitor.competitor} — ${competitor.notable_activity}`,
        `Threat level: HIGH. ${competitor.positioning}\nCaldera differentiator: ${competitor.caldera_differentiator}`,
      )
      issuesCreated++
    }
  }

  // Save EOS action recommendations as pending_review
  for (const action of analysis.eos_actions) {
    const actionOutput: AgentOutputInsert = {
      organization_id: organizationId,
      agent_id: 'marketing-strategist',
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

const SYSTEM_PROMPT = `You are the Marketing Strategist (Fractional CMO) for Caldera, a 14-person AI-powered product consultancy.

## Caldera's Committed Positioning
"AI-powered product consultancy that designs, builds, and accelerates digital products for companies that can't afford to move slowly."

## Brand Voice
- Confident, not arrogant. Lead with what you've built, not why you're better.
- Direct and specific. No jargon, no filler. If you built something in 4 weeks, say "4 weeks."
- Warm but professional. Think "smart colleague who sends thoughtful emails."
- Product-minded. Every piece should demonstrate product thinking — why it matters to the end user.
- Transparent. "Authenticity is the new currency in the AI world."

## Language Rules
- USE: "build" over "deliver", "ship" over "implement", "design" over "architect", "team" over "resources", "partner" over "vendor", "outcomes" over "deliverables", "accelerate" over "optimize"
- AVOID: "resources" (people are not resources), "leverage" (say "use"), "best-in-class" (unsubstantiable), "digital transformation" (meaningless), "synergy/alignment/ecosystem" (consultant-speak), "disrupt" (cliché)

## Key Context
- ~73% revenue from single anchor client. Diversification is existential.
- Repositioning from "dev services" to "AI-powered product consultancy"
- Three partners: Rich (CEO/CFO/COO), John (Sales), Wade (Engineering/CTO)
- Blank Metal is co-opetition: competitor AND subcontractor. Handle carefully — learn from them but don't become their delivery arm.
- Positioning score baseline: 3/10 as of February 2026 assessment
- Zero published case studies. Zero founder LinkedIn presence. Website says "A Refreshing Approach to Digital Services" — doesn't match target identity.

## Client Language Mining
Red flags (T&M mindset): "paying for staff/capacity", "how many hours/resources", deliverable-counting language
Green flags (value-buyer): "figure out what it's like to work together", "business outcomes", "measurable results", "what's the ROI", "we need to move faster"

## Competitor Watch List
- Blank Metal: blog/newsletter "The So What", job postings, partnership announcements. Co-opetition dynamic.
- Livefront (+ Zeal IT): post-merger activity, AI positioning shifts, job postings for AI roles
- "AI product consultancy" keyword positioning broadly
- Anthropic/Vercel partner directory changes

Analyze the data and produce actionable marketing intelligence. Focus on what changed since the last analysis, not static descriptions. Be specific about what Caldera should do differently.`

// ============================================
// Data fetching
// ============================================

async function getClientTranscripts(organizationId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabaseAdmin
    .from('ingested_data')
    .select('payload, source_timestamp')
    .eq('organization_id', organizationId)
    .eq('source', 'grain')
    .eq('data_type', 'transcript_summary')
    .gte('source_timestamp', thirtyDaysAgo)
    .order('source_timestamp', { ascending: false })
    .limit(20)

  return data || []
}

async function getCompetitorNews() {
  return fetchIndustryNews([
    'Blank Metal AI engineering company Minneapolis',
    'Livefront Zeal IT digital consultancy merger',
    'AI product consultancy services market 2026',
  ])
}

async function getDealNarratives(organizationId: string) {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabaseAdmin
    .from('ingested_data')
    .select('payload, source_timestamp')
    .eq('organization_id', organizationId)
    .eq('source', 'hubspot')
    .eq('data_type', 'deal')
    .gte('source_timestamp', ninetyDaysAgo)
    .order('source_timestamp', { ascending: false })
    .limit(30)

  return data || []
}

async function getExistingMarketingIssues(organizationId: string) {
  const { data } = await supabaseAdmin
    .from('issues')
    .select('title, status, created_at')
    .eq('organization_id', organizationId)
    .eq('status', 'open')
    .or('title.ilike.%marketing%,title.ilike.%positioning%,title.ilike.%brand%,title.ilike.%competitive%,title.ilike.%content%')
    .limit(10)

  return data || []
}

// ============================================
// Prompt builder
// ============================================

function buildAnalysisPrompt(
  transcripts: Array<{ payload: Record<string, unknown>; source_timestamp: string }>,
  competitorNews: Array<{ title: string; detail: string; source: string }>,
  deals: Array<{ payload: Record<string, unknown>; source_timestamp: string }>,
  existingIssues: Array<{ title: string; status: string; created_at: string }>,
): string {
  const sections: string[] = []

  // Client transcripts for language mining
  if (transcripts.length > 0) {
    sections.push(`## Client Meeting Transcripts (${transcripts.length}, last 30 days)`)
    sections.push('Analyze these for client language patterns — red flags (T&M mindset) vs. green flags (value-buyer mindset).')
    sections.push(JSON.stringify(transcripts.map(t => ({
      meeting_title: t.payload.meeting_title,
      meeting_type: t.payload.meeting_type,
      summary: t.payload.summary,
      key_points: t.payload.key_points,
      action_items: t.payload.action_items,
      date: t.source_timestamp,
    })), null, 2))
  } else {
    sections.push('## Client Transcripts: No recent transcripts available for language mining.')
  }

  // Competitor news
  if (competitorNews.length > 0) {
    sections.push(`## Competitor & Market News (${competitorNews.length} items)`)
    sections.push(JSON.stringify(competitorNews, null, 2))
  } else {
    sections.push('## Competitor News: No news available this cycle. Note this as a gap — Brave Search API may not be configured.')
  }

  // Deal narratives for win/loss patterns
  if (deals.length > 0) {
    sections.push(`## Recent Deals (${deals.length}, last 90 days)`)
    sections.push('Analyze for win/loss patterns, how Caldera is being positioned in deals, and pricing model trends.')
    sections.push(JSON.stringify(deals.map(d => ({
      deal_name: d.payload.deal_name || d.payload.name,
      amount: d.payload.amount,
      stage: d.payload.stage || d.payload.dealstage,
      close_date: d.payload.close_date || d.payload.closedate,
      status: d.payload.status,
    })), null, 2))
  }

  // Existing issues to avoid duplicates
  if (existingIssues.length > 0) {
    sections.push(`## Existing Marketing Issues (${existingIssues.length})`)
    sections.push(JSON.stringify(existingIssues, null, 2))
    sections.push('Do not duplicate existing issues.')
  }

  sections.push('\nAnalyze this data and produce your marketing strategy assessment. Focus on what changed, what needs attention, and specific actions.')

  return sections.join('\n\n')
}

// ============================================
// Issue creation (with duplicate check)
// ============================================

async function createMarketingIssue(
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
    description: `[Auto-generated by Marketing Strategist]\n\n${detail}`,
    status: 'open',
    priority: 1,
    created_by: null,
  })
}
