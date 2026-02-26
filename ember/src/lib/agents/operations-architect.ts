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

const operationsAnalysisSchema = z.object({
  headline: z.string().describe('One-line operations summary, e.g. "3 active projects on track, 1 scope variance alert on Acme migration"'),

  delivery_health: z.object({
    active_engagements: z.number(),
    on_track: z.number(),
    at_risk: z.number(),
    utilization_note: z.string().describe('Team utilization observation if data available, otherwise "No utilization data"'),
  }),

  scope_variance_alerts: z.array(z.object({
    project_name: z.string(),
    original_scope: z.string().describe('What was sold/agreed'),
    current_state: z.string().describe('What is being delivered or what changed'),
    variance_type: z.enum(['scope_creep', 'under_delivery', 'timeline_slip', 'resource_mismatch']),
    risk_level: z.enum(['low', 'medium', 'high']),
    recommended_action: z.string(),
  })).describe('Projects where delivery diverges from sold scope'),

  client_satisfaction_signals: z.array(z.object({
    client_name: z.string(),
    signal_type: z.enum(['positive', 'negative', 'neutral']),
    source: z.string().describe('Where the signal came from: transcript, email, deal notes, etc.'),
    detail: z.string(),
    recommended_action: z.string().nullable(),
  })).describe('Client sentiment indicators from recent communications'),

  sow_insights: z.object({
    documents_found: z.number(),
    recent_documents: z.array(z.object({
      name: z.string(),
      document_type: z.string(),
      last_modified: z.string(),
      note: z.string(),
    })),
    standardization_note: z.string().describe('Assessment of SOW consistency and template usage'),
  }).describe('SOW template and document analysis'),

  handoff_status: z.array(z.object({
    deal_or_project: z.string(),
    handoff_stage: z.enum(['pre_handoff', 'in_transition', 'completed', 'at_risk']),
    from: z.string().describe('e.g., Sales (John)'),
    to: z.string().describe('e.g., Delivery (Wade)'),
    gaps: z.string().nullable().describe('Missing info or unclear handoff items'),
    recommended_action: z.string(),
  })).describe('Sales-to-delivery handoff tracking'),

  process_observations: z.array(z.object({
    area: z.string(),
    observation: z.string(),
    recommendation: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
  })).describe('Process improvement opportunities identified from data patterns'),

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
    system: `You are the Operations Architect for Caldera, a 14-person software services company.

Key context:
- ~73% revenue from single anchor client. Quality delivery is non-negotiable for retention.
- Transitioning from T&M to fixed-fee engagements — scoping accuracy is existential.
- Three partners: Wade (Ops/Engineering — your primary consumer), Rich (CEO/CFO), John (Sales)
- SOWs and process docs are in Google Drive. Deal scope comes from HubSpot.
- Meeting transcripts from Grain reveal delivery discussions, client feedback, scope changes.

Analyze the provided data and produce operational intelligence. Focus on:
1. Scope variance — is delivery matching what was sold?
2. Client satisfaction — what are clients saying in meetings and emails?
3. Handoff quality — are deals transitioning cleanly from Sales to Delivery?
4. SOW standardization — are we using templates consistently?
5. Process gaps — what recurring problems should become documented processes?

Be specific with project names, dates, and client names. Wade values clarity and actionability.
If no Drive data is available, note that Google Drive integration needs to be configured and
focus analysis on transcripts and deal data.`,
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
      await createOperationsIssue(
        organizationId,
        `Scope Variance: ${alert.project_name} — ${alert.variance_type}`,
        `${alert.current_state}\n\nRecommended action: ${alert.recommended_action}`,
      )
      issuesCreated++
    }
  }

  for (const handoff of analysis.handoff_status) {
    if (handoff.handoff_stage === 'at_risk' && handoff.gaps) {
      await createOperationsIssue(
        organizationId,
        `Handoff Risk: ${handoff.deal_or_project} — ${handoff.from} → ${handoff.to}`,
        `Gaps: ${handoff.gaps}\n\nRecommended action: ${handoff.recommended_action}`,
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
    .or('title.ilike.%delivery%,title.ilike.%scope%,title.ilike.%sow%,title.ilike.%handoff%,title.ilike.%operations%')
    .limit(10)

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

  sections.push('\nAnalyze this data and produce your operations assessment.')

  return sections.join('\n\n')
}

// ============================================
// Issue auto-creation
// ============================================

async function createOperationsIssue(
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
    description: `[Auto-generated by Operations Architect]\n\n${detail}`,
    status: 'open',
    priority: 'high',
    created_by: null,
  })
}
