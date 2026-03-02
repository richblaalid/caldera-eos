import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { saveAgentOutput, createAgentIssue } from './agent-runtime'
import { daysAgo } from '@/lib/dates'
import type { AgentOutputInsert } from '@/types/agents'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Operations maturity & delivery thresholds from Cowork Operations Strategy Assessment
const OPS_THRESHOLDS = {
  targetUtilization: 73,       // 70-75% for engineers
  yellowUtilization: 65,
  redUtilization: 55,
  maxUtilization: 90,          // Burnout risk above this
  targetSprintCompletion: 85,
  yellowSprintCompletion: 75,
  scopeChangeYellow: 3,        // changes/month per engagement
  scopeChangeRed: 4,
  scopeExpansionYellow: 15,    // % of SOW value
  scopeExpansionRed: 25,
  prReviewYellow: 8,           // hours
  prReviewRed: 24,
  handoffPassingScore: 24,     // out of 34
  // Client Health Score thresholds
  chsExpansion: 80,            // Predict expansion
  chsAtRisk: 60,               // Schedule partner check-in
  chsChurnImminent: 40,        // Emergency meeting
  // SOW quality
  sowQualityGreen: 90,         // % of required sections
  sowQualityYellow: 75,
  sowQualityRed: 60,
  // Bench time
  benchAlertWeeks: 2,
  benchCriticalWeeks: 4,
}

const operationsAnalysisSchema = z.object({
  headline: z.string().describe('One-line operations summary, e.g. "3 active projects on track, 1 scope variance alert on Acme migration"'),

  ops_maturity_score: z.number().describe('Overall operations maturity 1-10. Current baseline: 3/10. Track progression.'),

  delivery_health: z.object({
    active_engagements: z.number(),
    on_track: z.number(),
    at_risk: z.number(),
    engagement_scores: z.array(z.object({
      client_name: z.string(),
      engagement_type: z.enum(['retainer', 'fixed_fee', 't_and_m', 'subcontract']),
      health_score: z.number().describe('Composite 0-100. Schedule (20%), Scope (25%), Budget (20%), Client Satisfaction (15%), Team Health (10%), Delivery Quality (10%)'),
      health_status: z.enum(['green', 'yellow', 'orange', 'red']).describe('green: >=80, yellow: 60-79, orange: 40-59, red: <40'),
      key_concern: z.string().nullable(),
    })).describe('Per-engagement health scores'),
    utilization_estimate: z.object({
      overall_pct: z.number().nullable().describe('Team-wide billable utilization estimate. Target: 70-75%'),
      bench_risk: z.string().nullable().describe('Any team members at risk of bench time, with dates'),
      overallocation_risk: z.string().nullable().describe('Any team members at >90% allocation'),
    }),
  }),

  scope_variance_alerts: z.array(z.object({
    project_name: z.string(),
    original_scope: z.string().describe('What was sold/agreed'),
    current_state: z.string().describe('What is being delivered or what changed'),
    variance_type: z.enum(['scope_creep', 'under_delivery', 'timeline_slip', 'resource_mismatch', 'verbal_commitment']),
    scope_expansion_pct: z.number().nullable().describe('Estimated total scope expansion as % of SOW value. Yellow >15%, Red >25%.'),
    risk_level: z.enum(['low', 'medium', 'high']),
    evidence: z.string().describe('Quote or data point supporting this alert'),
    recommended_action: z.string(),
  })).describe('Projects where delivery diverges from sold scope. Detect: "can we also", "one more thing", "while you\'re in there" from clients. Flag verbal commitments from engineers.'),

  client_health_scores: z.array(z.object({
    client_name: z.string(),
    health_score: z.number().describe('Client Health Score 0-100. Meeting engagement (25%), transcript sentiment (25%), scope stability (20%), responsiveness (15%), expansion signals (15%)'),
    prediction: z.enum(['expansion_likely', 'steady_state', 'at_risk', 'churn_imminent']).describe('expansion: >80 + expansion signals. at_risk: 40-60 declining. churn: <40 or 20pt drop.'),
    positive_signals: z.array(z.string()),
    negative_signals: z.array(z.string()),
    recommended_action: z.string().nullable(),
  })).describe('Client Health Score with churn/expansion prediction'),

  sow_insights: z.object({
    documents_found: z.number(),
    recent_documents: z.array(z.object({
      name: z.string(),
      document_type: z.string(),
      last_modified: z.string(),
      quality_score: z.number().nullable().describe('SOW quality score 0-100. Check: executive summary, objectives, scope, out-of-scope (CRITICAL), engagement model, approach, roles, fees, timeline, assumptions, change management (CRITICAL), acceptance criteria, AI practices, IP'),
      gaps: z.array(z.string()).describe('Missing required sections'),
      note: z.string(),
    })),
    standardization_note: z.string().describe('Assessment of SOW consistency. AR SOW is the gold standard template.'),
    anti_patterns: z.array(z.string()).describe('Detected SOW anti-patterns: no out-of-scope, TBD deliverables, no change management, no client response SLA, open-ended fixed-fee scope, hourly rate in fixed-fee'),
  }).describe('SOW template and document analysis'),

  handoff_status: z.array(z.object({
    deal_or_project: z.string(),
    handoff_stage: z.enum(['pre_handoff', 'in_transition', 'completed', 'at_risk']),
    handoff_score: z.number().nullable().describe('Handoff quality score 0-34. Passing: >=24. Green: 28-34, Yellow: 24-27, Orange: 18-23, Red: <18.'),
    from: z.string().describe('e.g., Sales (John)'),
    to: z.string().describe('e.g., Delivery (Wade)'),
    gaps: z.string().nullable().describe('Missing: signed SOW, out-of-scope definition, team allocation, access provisioning, etc.'),
    recommended_action: z.string(),
  })).describe('Sales-to-delivery handoff tracking with quality scoring'),

  capacity_forecast: z.object({
    available_ftes_30d: z.number().nullable().describe('Available FTEs in next 30 days'),
    available_ftes_60d: z.number().nullable().describe('Available FTEs in 30-60 days'),
    available_ftes_90d: z.number().nullable().describe('Available FTEs in 60-90 days'),
    key_transitions: z.array(z.string()).describe('e.g. "MOBE ending Jun 5 → +1 designer available"'),
    capacity_alerts: z.array(z.string()).describe('Overstaffed/understaffed/overallocation risks'),
  }).describe('30/60/90 day capacity forecast'),

  subcontractor_status: z.array(z.object({
    partner_name: z.string().describe('e.g., Blank Metal'),
    project_name: z.string(),
    status: z.enum(['active', 'ramping', 'winding_down', 'completed']),
    margin_estimate_pct: z.number().nullable().describe('Must be >25% minimum'),
    concerns: z.array(z.string()),
  })).describe('Subcontractor engagement tracking'),

  process_observations: z.array(z.object({
    area: z.string(),
    current_maturity: z.enum(['ad_hoc', 'defined', 'managed', 'optimized', 'automated']).describe('Level 1-5: ad_hoc(1), defined(2), managed(3), optimized(4), automated(5)'),
    target_maturity: z.enum(['ad_hoc', 'defined', 'managed', 'optimized', 'automated']),
    observation: z.string(),
    recommendation: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
  })).describe('Process maturity observations against 5-level model'),

  eos_actions: z.array(z.object({
    type: z.enum(['create_issue', 'create_todo']),
    title: z.string(),
    detail: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    owner_hint: z.string().describe('Suggested owner: Rich, John, or Wade'),
  })).describe('Recommended EOS actions for operational risks'),
})

type OperationsAnalysis = z.infer<typeof operationsAnalysisSchema>

/**
 * Run overnight operations analysis.
 * Queries Google Drive SOW docs, Grain transcripts, HubSpot deals, and EOS data.
 * Produces structured delivery intelligence and auto-creates Issues for high-risk items.
 */
export async function runOperationsAnalysis(organizationId: string): Promise<{
  analysis: OperationsAnalysis
  outputsCreated: number
  issuesCreated: number
}> {
  const [sowDocuments, deliveryTranscripts, dealData, existingIssues, deliveryRocks] = await Promise.all([
    getSOWDocuments(organizationId),
    getDeliveryTranscripts(organizationId),
    getDealData(organizationId),
    getExistingOpsIssues(organizationId),
    getDeliveryRocks(organizationId),
  ])

  const prompt = buildAnalysisPrompt(sowDocuments, deliveryTranscripts, dealData, existingIssues, deliveryRocks)

  const { object: analysis } = await generateObject({
    model: anthropic(process.env.AGENT_DEFAULT_MODEL || 'claude-sonnet-4-20250514'),
    schema: operationsAnalysisSchema,
    prompt,
    system: `You are the Operations Architect for Caldera, a 14-person AI-powered product consultancy.

PERSONALITY: Engineering-minded, data-driven, systematic. Wade (CTO/Engineering Partner) is your primary consumer. He wants detection rules, thresholds, and automated alerts — not hand-wavy observations. Lead with the detection, then the evidence, then the recommended action. Use "IF X THEN Y" language when flagging issues.

COMPANY CONTEXT:
- ~$2.5M revenue, 73% from Church's ($1.8M/year). Quality delivery is non-negotiable for retention.
- Church's 2026 SOW has a 20% reduction clause — could reduce staffing/fees by $360K/year.
- MOBE (~$480K/year) ending after June 2026 → 1 designer coming off engagement.
- Transitioning from T&M to fixed-fee — scoping accuracy is existential.
- No PSA tool. QuickBooks for billing, Google Drive for docs.
- ~11 billable staff (engineers + designers). Monthly burn ~$192K.
- Blank Metal is a subcontractor partner (they sell, we deliver). First project: Pivotal Advisors.
- Current operations maturity: 3/10. Strong engineering culture, weak process infrastructure.

DELIVERY HEALTH SCORECARD (per engagement, weekly):
Score each engagement 0-100 across 6 dimensions:
1. Schedule Health (20%): sprint completion rate, milestone dates vs plan
2. Scope Health (25%): change requests, out-of-scope mentions in transcripts
3. Budget Health (20%): hours burned vs SOW budget (T&M) or margin tracking (fixed-fee)
4. Client Satisfaction (15%): transcript sentiment, meeting frequency, stakeholder engagement
5. Team Health (10%): standup attendance, retro feedback, morale signals
6. Delivery Quality (10%): bug rate, PR review times, deployment frequency

Score thresholds: GREEN >=80, YELLOW 60-79, ORANGE 40-59, RED <40
Alert matrix: INFO (within 10% of yellow) → Wade daily. WARNING (yellow) → Wade + lead, 48h. CRITICAL (red) → Wade + Rich, same-day. EMERGENCY (2+ red) → all partners, 2h.

UTILIZATION TARGETS:
- Engineers: target ${OPS_THRESHOLDS.targetUtilization}%, yellow <${OPS_THRESHOLDS.yellowUtilization}%, red <${OPS_THRESHOLDS.redUtilization}%
- Designers: target 65-70%, yellow <60%, red <50%
- Wade: 40-50% (balance delivery + management)
- Burnout risk: anyone >${OPS_THRESHOLDS.maxUtilization}% for 2+ consecutive weeks
- Overall billable team target: 68-73%
- Revenue per billable employee: current $227K/year, target $300K/year

SCOPE CREEP DETECTION (critical for fixed-fee margin):
At Caldera's scale, 20% scope creep on a $20K/month fixed-fee = $4K/month loss. Across 3 engagements annually = ~$147K margin erosion (existential at $2.5M revenue).

High-confidence scope creep signals from transcripts (auto-flag):
- Client says: "can we also", "what if we added", "one more thing", "while you're in there" + not in SOW → 90% confidence
- Engineer says: "sure we can do that", "shouldn't be too hard", "we'll take a look" to client re: unlisted work → 85% confidence, URGENT (verbal commitment)
- New integration/API/vendor not in SOW assumptions → 80%
- Timeline extension discussion → 75%
- New stakeholders in delivery meetings not in original RACI → 70%

Scope expansion thresholds: >${OPS_THRESHOLDS.scopeExpansionYellow}% of SOW value = YELLOW, >${OPS_THRESHOLDS.scopeExpansionRed}% = RED

Change order process: Detect → Classify (clarification/minor <8h/material 8-40h/major >40h) → Material+ requires written change order → No work starts until signed.

CLIENT HEALTH SCORE (weekly, per client):
Compute from: meeting engagement (25%), transcript sentiment (25%), scope stability (20%), client responsiveness (15%), expansion signals (15%).
Positive signals (+points): praises quality, introduces new stakeholders, discusses future phases, responds <24h, "phenomenal"/"great team"
Negative signals (-points): cancels meetings repeatedly (-10), frustration language (-8), scope reduction (-15), competitor mentioned (-20), silent stakeholders (-12), payment delays (-10)
Predictions: >80 + expansion signals → expansion likely. 60-80 stable → steady state. 40-60 declining 3wks → at risk. <40 or 20pt drop → churn imminent.

MOBE CHURN CASE STUDY: Signals were predictable (strategy shift → scope narrowed → end date discussed → designer-only SOW). Apply these patterns to detect early churn signals on all clients.

SOW STANDARDIZATION:
14 required sections. AR SOW is the gold standard template. Quality = sections_present ÷ 14 × 100.
CRITICAL sections (flag if missing): Out-of-scope, Change management
Anti-patterns to flag: no out-of-scope section, "TBD" deliverables, no change management clause, no client response SLA, fixed-fee with "including but not limited to" (unlimited liability), hourly rate in fixed-fee context

HANDOFF QUALITY (sales → delivery):
Score 0-34 across: Client Context (8pts), Scope & Commercial (12pts), Delivery Setup (14pts)
Passing score: >=${OPS_THRESHOLDS.handoffPassingScore}. GREEN 28-34, YELLOW 24-27, ORANGE 18-23, RED <18 (do NOT start delivery).
Auto-create Issues for: no signed SOW, no out-of-scope, no change management clause, team >90% allocated, no DM identified, access not provisioned 3+ days post-kickoff.

CAPACITY FORECAST (30/60/90 day):
Key transitions to track: MOBE ending June → +1 designer. Pivotal ending ~Apr → +1 engineer.
Bench protocol: 1-5 days → internal product (Ember). 1-2 weeks → internal sprint. 2-4 weeks → FLAG cash burn. >4 weeks → ESCALATE (hiring freeze / separation review).

SUBCONTRACTOR TRACKING (Blank Metal):
Separate time tracking, minimum 25% margin, written scope for every engagement, change orders apply, direct client access preferred, invoice Net 15.
Monitor: hours vs commitment, scope changes from BM, margin, payment aging.

PROCESS MATURITY MODEL (5 levels):
1-Ad Hoc (in heads), 2-Defined (documented sometimes), 3-Managed (documented + measured + consistent), 4-Optimized (continuous improvement), 5-Automated (AI-monitored).
Priority process gaps: #1 Change Order Process (0→3), #2 Scope Management (1→3), #3 Handoff (1→3), #4 Capacity Planning (1→3).

Be specific with project names, dates, and client names. If no Drive data is available, note that Google Drive integration needs configuration and focus on transcripts and deal data.`,
  })

  // Save main analysis
  const mainOutput: AgentOutputInsert = {
    organization_id: organizationId,
    agent_id: 'operations-architect',
    output_type: 'analysis',
    title: `Operations Analysis — ${new Date().toISOString().split('T')[0]}`,
    summary: analysis.headline,
    content: analysis as unknown as Record<string, unknown>,
    trust_zone: 1,
    status: 'completed',
  }
  await saveAgentOutput(mainOutput)

  let issuesCreated = 0
  let outputsCreated = 1

  // Auto-create Issues for high-risk scope variance and at-risk handoffs (Zone 1)
  for (const alert of analysis.scope_variance_alerts) {
    if (alert.risk_level === 'high') {
      await createAgentIssue(
        organizationId,
        'Operations Architect',
        `Scope Variance: ${alert.project_name} — ${alert.variance_type}`,
        `${alert.current_state}\n\nRecommended action: ${alert.recommended_action}`,
      )
      issuesCreated++
    }
  }

  for (const handoff of analysis.handoff_status) {
    if (handoff.handoff_stage === 'at_risk' && handoff.gaps) {
      await createAgentIssue(
        organizationId,
        'Operations Architect',
        `Handoff Risk: ${handoff.deal_or_project} — ${handoff.from} → ${handoff.to}`,
        `Gaps: ${handoff.gaps}\n\nRecommended action: ${handoff.recommended_action}`,
      )
      issuesCreated++
    }
  }

  // Auto-create Issues for churn-imminent clients (Zone 1)
  for (const client of analysis.client_health_scores) {
    if (client.prediction === 'churn_imminent') {
      await createAgentIssue(
        organizationId,
        'Operations Architect',
        `Client Churn Risk: ${client.client_name} — Health Score ${client.health_score}`,
        `Prediction: Churn imminent. Negative signals: ${client.negative_signals.join(', ')}\n\nRecommended action: ${client.recommended_action || 'Emergency partner meeting within 24 hours.'}`,
      )
      issuesCreated++
    }
  }

  // Auto-create Issues for red scope expansion
  for (const alert of analysis.scope_variance_alerts) {
    if (alert.scope_expansion_pct && alert.scope_expansion_pct > OPS_THRESHOLDS.scopeExpansionRed) {
      await createAgentIssue(
        organizationId,
        'Operations Architect',
        `Scope Expansion RED: ${alert.project_name} — ${alert.scope_expansion_pct}% over SOW`,
        `Evidence: ${alert.evidence}\n\nRecommended action: ${alert.recommended_action}`,
      )
      issuesCreated++
    }
  }

  // Save EOS action recommendations as pending_review
  for (const action of analysis.eos_actions) {
    const actionOutput: AgentOutputInsert = {
      organization_id: organizationId,
      agent_id: 'operations-architect',
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
// Data fetching
// ============================================

async function getSOWDocuments(organizationId: string) {
  const { data } = await supabaseAdmin
    .from('ingested_data')
    .select('payload, source_timestamp')
    .eq('organization_id', organizationId)
    .eq('source', 'google_drive')
    .eq('data_type', 'document')
    .order('source_timestamp', { ascending: false })
    .limit(30)

  return data || []
}

async function getDeliveryTranscripts(organizationId: string) {
  const thirtyDaysAgo = daysAgo(30)

  const { data } = await supabaseAdmin
    .from('ingested_data')
    .select('payload, source_timestamp')
    .eq('organization_id', organizationId)
    .eq('source', 'grain')
    .eq('data_type', 'transcript_summary')
    .gte('source_timestamp', thirtyDaysAgo)
    .order('source_timestamp', { ascending: false })
    .limit(15)

  // Filter for delivery-relevant transcripts
  return (data || []).filter(d => {
    const tags = (d as { relevance_tags?: string[] }).relevance_tags || []
    const payload = d.payload as Record<string, unknown>
    const title = ((payload.meeting_title as string) || '').toLowerCase()
    return tags.some(t => ['delivery', 'client', 'kickoff', 'internal'].includes(t)) ||
      /kickoff|delivery|scope|status|standup|retro|handoff/.test(title)
  })
}

async function getDealData(organizationId: string) {
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

async function getExistingOpsIssues(organizationId: string) {
  const { data } = await supabaseAdmin
    .from('issues')
    .select('title, status, created_at')
    .eq('organization_id', organizationId)
    .eq('status', 'open')
    .or('title.ilike.%delivery%,title.ilike.%scope%,title.ilike.%sow%,title.ilike.%handoff%,title.ilike.%operations%,title.ilike.%utilization%,title.ilike.%capacity%,title.ilike.%bench%,title.ilike.%subcontract%')
    .limit(15)

  return data || []
}

async function getDeliveryRocks(organizationId: string) {
  const { data } = await supabaseAdmin
    .from('rocks')
    .select('title, status, due_date, owner_id, milestones')
    .eq('organization_id', organizationId)
    .in('status', ['on_track', 'off_track', 'at_risk'])
    .limit(15)

  // Filter for delivery/ops-related rocks
  return (data || []).filter(r => {
    const title = (r.title as string).toLowerCase()
    return /deliver|process|ops|sow|scope|template|handoff|capacity|utiliz/.test(title)
  })
}

// ============================================
// Prompt builder
// ============================================

function buildAnalysisPrompt(
  sowDocs: Array<{ payload: Record<string, unknown>; source_timestamp: string }>,
  transcripts: Array<{ payload: Record<string, unknown>; source_timestamp: string }>,
  deals: Array<{ payload: Record<string, unknown>; source_timestamp: string }>,
  existingIssues: Array<{ title: string; status: string; created_at: string }>,
  deliveryRocks: Array<Record<string, unknown>>,
): string {
  const sections: string[] = []

  // SOW & Process Documents
  if (sowDocs.length > 0) {
    sections.push(`## SOW & Process Documents (${sowDocs.length} from Google Drive)`)
    sections.push(JSON.stringify(sowDocs.map(d => ({
      file_name: d.payload.file_name,
      document_type: d.payload.document_type,
      last_modified: d.payload.modified_at,
      content_preview: typeof d.payload.content_preview === 'string'
        ? d.payload.content_preview.slice(0, 2000)
        : '',
    })), null, 2))
  } else {
    sections.push('## SOW & Process Documents\nNo Google Drive data available. Google Drive integration may not be configured yet.')
  }

  // Delivery-relevant transcripts
  if (transcripts.length > 0) {
    sections.push(`## Recent Delivery Transcripts (${transcripts.length}, last 30 days)`)
    sections.push(JSON.stringify(transcripts.map(t => ({
      meeting_title: t.payload.meeting_title,
      meeting_type: t.payload.meeting_type,
      summary: t.payload.summary,
      key_points: t.payload.key_points,
      action_items: t.payload.action_items,
      decisions: t.payload.decisions,
      date: t.source_timestamp,
    })), null, 2))
  } else {
    sections.push('## Delivery Transcripts\nNo recent delivery-relevant transcripts found.')
  }

  // Deal data for scope context
  if (deals.length > 0) {
    sections.push(`## Active Deals & Projects (${deals.length} from HubSpot)`)
    sections.push(JSON.stringify(deals.map(d => ({
      deal_name: d.payload.deal_name,
      amount: d.payload.amount,
      stage: d.payload.stage,
      close_date: d.payload.close_date,
      deal_age_days: d.payload.deal_age_days,
    })), null, 2))
  } else {
    sections.push('## Deals & Projects\nNo HubSpot deal data available.')
  }

  // Delivery Rocks
  if (deliveryRocks.length > 0) {
    sections.push(`## Delivery Rocks (${deliveryRocks.length})`)
    sections.push(JSON.stringify(deliveryRocks.map(r => ({
      title: r.title,
      status: r.status,
      due_date: r.due_date,
      milestones: r.milestones,
    })), null, 2))
  }

  // Existing operational issues
  if (existingIssues.length > 0) {
    sections.push(`## Existing Operations Issues (${existingIssues.length})`)
    sections.push(JSON.stringify(existingIssues, null, 2))
    sections.push('Note: Do not duplicate existing issues. Reference them if relevant.')
  }

  sections.push('\nAnalyze this data and produce your operations assessment. Score each engagement\'s delivery health (0-100). Compute Client Health Scores with churn/expansion predictions. Assess SOW quality against the 14-section standard. Score handoff quality (0-34). Detect scope creep signals. Estimate utilization and capacity forecast.')

  return sections.join('\n\n')
}

