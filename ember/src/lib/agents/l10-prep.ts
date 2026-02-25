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

// =============================================
// Schema
// =============================================

const l10PrepSchema = z.object({
  headline: z.string().describe('One-line summary of what the team should focus on this L10'),

  segue_prompt: z.string().describe('Opening question for the segue round — personal/professional good news prompt'),

  scorecard_review: z.object({
    summary: z.string().describe('1-2 sentence summary of scorecard health'),
    metrics: z.array(z.object({
      name: z.string(),
      owner: z.string(),
      status: z.enum(['on_track', 'off_track', 'missing']),
      trend: z.string().describe('↑ ↓ → or "no data"'),
      note: z.string().describe('Brief context — why off track, or consecutive misses'),
    })),
  }),

  rock_review: z.object({
    summary: z.string().describe('1-2 sentence summary of Rock progress'),
    rocks: z.array(z.object({
      title: z.string(),
      owner: z.string(),
      status: z.enum(['on_track', 'off_track', 'at_risk', 'complete']),
      completion_pct: z.number().describe('Percentage of milestones completed'),
      days_until_due: z.number().nullable(),
      note: z.string().describe('Key context — upcoming milestones, blockers, stalled'),
    })),
  }),

  todo_review: z.object({
    completion_rate_2wk: z.number().describe('To-do completion rate over last 2 weeks (percentage)'),
    overdue_count: z.number(),
    carryforward_items: z.array(z.string()).describe('To-do titles that have been carried forward'),
    note: z.string().describe('Brief assessment of to-do discipline'),
  }),

  issues_list: z.array(z.object({
    title: z.string(),
    age_days: z.number(),
    priority: z.enum(['high', 'medium', 'low']),
    source: z.string().describe('Who or what raised this — manual, financial-strategist, bd-strategist, nudge-engine'),
    recommended_order: z.number().describe('Suggested IDS priority order (1 = first to discuss)'),
  })).describe('Issues prioritized for IDS discussion'),

  financial_snapshot: z.string().describe('2-3 sentence financial health summary from Financial Strategist'),

  pipeline_snapshot: z.string().describe('2-3 sentence pipeline/BD summary from BD Strategist'),

  last_l10_followups: z.array(z.string()).describe('Action items from the last L10 that should be reviewed'),

  ember_observations: z.array(z.string()).describe('Patterns Ember has noticed that the team may not be discussing — the "surface what\'s not being said" items'),
})

export type L10Prep = z.infer<typeof l10PrepSchema>

// =============================================
// Main entry point
// =============================================

/**
 * Generate comprehensive L10 meeting prep by aggregating all agent data.
 * Returns the prep document and the agent_output ID for deduplication.
 */
export async function generateL10Prep(organizationId: string): Promise<{
  prep: L10Prep
  outputId: string | null
}> {
  // Gather all data in parallel
  const [
    rocks,
    todos,
    scorecardData,
    openIssues,
    financialAnalysis,
    pipelineAnalysis,
    lastL10Transcript,
    ownerMap,
  ] = await Promise.all([
    getRocks(organizationId),
    getTodos(organizationId),
    getScorecardData(organizationId),
    getOpenIssues(organizationId),
    getLatestAnalysis(organizationId, 'financial-strategist'),
    getLatestAnalysis(organizationId, 'bd-strategist'),
    getLastL10Transcript(organizationId),
    getOwnerMap(organizationId),
  ])

  const prompt = buildL10PrepPrompt({
    rocks,
    todos,
    scorecardData,
    openIssues,
    financialAnalysis,
    pipelineAnalysis,
    lastL10Transcript,
    ownerMap,
  })

  const model = process.env.AGENT_DEFAULT_MODEL || 'claude-sonnet-4-20250514'

  const { object: prep } = await generateObject({
    model: anthropic(model),
    schema: l10PrepSchema,
    prompt,
    system: `You are Ember, the AI Integrator for Caldera — a 14-person software services company running on EOS.

Your job is to prepare the L10 meeting prep document. This prep helps the three partners (Rich, John, Wade) run an effective 90-minute L10 meeting.

L10 meeting structure:
1. Segue (5 min) — personal/professional good news
2. Scorecard Review (5 min) — review weekly metrics, note off-track items
3. Rock Review (5 min) — quick on/off track for each Rock
4. Customer/Employee Headlines (5 min)
5. To-Do List (5 min) — done/not done from last week
6. IDS (60 min) — Identify, Discuss, Solve the priority Issues
7. Conclude (5 min) — recap new to-dos, rate the meeting

Your prep should:
- Prioritize Issues by urgency and data quality (not just age)
- Surface patterns the team might not be discussing
- Be specific with numbers — no vague observations
- Keep recommendations actionable and tied to EOS constructs`,
  })

  // Save as agent_output for history and deduplication
  const output: AgentOutputInsert = {
    organization_id: organizationId,
    agent_id: 'ea',
    output_type: 'briefing',
    title: `L10 Prep — ${new Date().toISOString().split('T')[0]}`,
    summary: prep.headline,
    content: prep as unknown as Record<string, unknown>,
    trust_zone: 1,
    status: 'completed',
  }
  const outputId = await saveAgentOutput(output)

  return { prep, outputId }
}

// =============================================
// Data queries
// =============================================

async function getRocks(organizationId: string) {
  const { data } = await supabaseAdmin
    .from('rocks')
    .select('id, title, owner_id, status, milestones, due_date, updated_at')
    .eq('organization_id', organizationId)
    .in('status', ['on_track', 'off_track', 'at_risk'])
    .order('due_date', { ascending: true })

  return data || []
}

async function getTodos(organizationId: string) {
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabaseAdmin
    .from('todos')
    .select('id, title, owner_id, due_date, completed, completed_at, created_at')
    .eq('organization_id', organizationId)
    .gte('created_at', twoWeeksAgo)
    .order('due_date', { ascending: true })

  return data || []
}

async function getScorecardData(organizationId: string) {
  const fourWeeksAgo = new Date()
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

  const { data: metrics } = await supabaseAdmin
    .from('scorecard_metrics')
    .select('id, name, owner_id, target, unit, goal_direction, is_active')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  if (!metrics || metrics.length === 0) return { metrics: [], entries: [] }

  const metricIds = metrics.map(m => m.id)

  const { data: entries } = await supabaseAdmin
    .from('scorecard_entries')
    .select('metric_id, value, week_of')
    .in('metric_id', metricIds)
    .gte('week_of', fourWeeksAgo.toISOString().split('T')[0])
    .order('week_of', { ascending: false })

  return { metrics, entries: entries || [] }
}

async function getOpenIssues(organizationId: string) {
  const { data } = await supabaseAdmin
    .from('issues')
    .select('id, title, description, priority, status, owner_id, source, created_at')
    .eq('organization_id', organizationId)
    .in('status', ['open', 'identified'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(20)

  return data || []
}

async function getLatestAnalysis(organizationId: string, agentId: string) {
  const { data } = await supabaseAdmin
    .from('agent_outputs')
    .select('content, summary, created_at')
    .eq('organization_id', organizationId)
    .eq('agent_id', agentId)
    .eq('output_type', 'analysis')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return data
}

async function getLastL10Transcript(organizationId: string) {
  const { data } = await supabaseAdmin
    .from('ingested_data')
    .select('payload, source_timestamp')
    .eq('organization_id', organizationId)
    .eq('source', 'grain')
    .eq('data_type', 'transcript_summary')
    .contains('relevance_tags', ['l10'])
    .order('source_timestamp', { ascending: false })
    .limit(1)
    .single()

  return data
}

async function getOwnerMap(organizationId: string): Promise<Map<string, string>> {
  const { data: members } = await supabaseAdmin
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)

  if (!members || members.length === 0) return new Map()

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name')
    .in('id', members.map(m => m.user_id))

  const map = new Map<string, string>()
  for (const p of profiles || []) {
    map.set(p.id, p.full_name || 'Unknown')
  }
  return map
}

// =============================================
// Prompt builder
// =============================================

function buildL10PrepPrompt(data: {
  rocks: Array<{ id: string; title: string; owner_id: string | null; status: string; milestones: unknown; due_date: string | null; updated_at: string }>
  todos: Array<{ id: string; title: string; owner_id: string | null; due_date: string | null; completed: boolean; completed_at: string | null; created_at: string }>
  scorecardData: { metrics: Array<{ id: string; name: string; owner_id: string | null; target: number | null; unit: string | null; goal_direction: string | null }>; entries: Array<{ metric_id: string; value: number | null; week_of: string }> }
  openIssues: Array<{ id: string; title: string; description: string | null; priority: number | null; owner_id: string | null; source: string | null; created_at: string }>
  financialAnalysis: { content: Record<string, unknown>; summary: string | null } | null
  pipelineAnalysis: { content: Record<string, unknown>; summary: string | null } | null
  lastL10Transcript: { payload: Record<string, unknown>; source_timestamp: string | null } | null
  ownerMap: Map<string, string>
}): string {
  const sections: string[] = []
  const ownerName = (id: string | null) => (id ? data.ownerMap.get(id) || 'Unassigned' : 'Unassigned')

  // Rocks
  sections.push('## Rocks')
  if (data.rocks.length > 0) {
    for (const rock of data.rocks) {
      const milestones = (rock.milestones || []) as Array<{ title: string; completed?: boolean; due_date?: string }>
      const completed = milestones.filter(m => m.completed).length
      const pct = milestones.length > 0 ? Math.round((completed / milestones.length) * 100) : 0
      const daysUntilDue = rock.due_date
        ? Math.ceil((new Date(rock.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null
      const daysSinceUpdate = Math.floor((Date.now() - new Date(rock.updated_at).getTime()) / (1000 * 60 * 60 * 24))

      sections.push(`- ${rock.title} | Owner: ${ownerName(rock.owner_id)} | Status: ${rock.status} | ${pct}% milestones done (${completed}/${milestones.length}) | Due: ${daysUntilDue !== null ? `${daysUntilDue} days` : 'no date'} | Last update: ${daysSinceUpdate} days ago`)
    }
  } else {
    sections.push('No active Rocks found.')
  }

  // Scorecard
  sections.push('\n## Scorecard (Last 4 Weeks)')
  if (data.scorecardData.metrics.length > 0) {
    for (const metric of data.scorecardData.metrics) {
      const entries = data.scorecardData.entries
        .filter(e => e.metric_id === metric.id)
        .sort((a, b) => b.week_of.localeCompare(a.week_of))
      const values = entries.map(e => e.value !== null ? `${e.value}${metric.unit || ''}` : 'missing').join(', ')
      const missCount = entries.filter(e => e.value === null).length
      const recentWeeks = 4 - entries.length // weeks with no entry at all

      sections.push(`- ${metric.name} | Owner: ${ownerName(metric.owner_id)} | Target: ${metric.target}${metric.unit || ''} ${metric.goal_direction || ''} | Recent: [${values}] | Missing weeks: ${missCount + recentWeeks}`)
    }
  } else {
    sections.push('No active Scorecard metrics found.')
  }

  // To-dos (2-week summary)
  sections.push('\n## To-Dos (Last 2 Weeks)')
  const totalTodos = data.todos.length
  const completedTodos = data.todos.filter(t => t.completed).length
  const overdue = data.todos.filter(t => !t.completed && t.due_date && new Date(t.due_date) < new Date())
  const completionRate = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0

  sections.push(`Total: ${totalTodos} | Completed: ${completedTodos} (${completionRate}%) | Overdue: ${overdue.length}`)
  if (overdue.length > 0) {
    sections.push('Overdue items:')
    for (const t of overdue.slice(0, 5)) {
      sections.push(`  - ${t.title} (${ownerName(t.owner_id)})`)
    }
  }

  // Issues
  sections.push('\n## Open Issues')
  if (data.openIssues.length > 0) {
    for (const issue of data.openIssues) {
      const ageDays = Math.floor((Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24))
      sections.push(`- ${issue.title} | Priority: ${issue.priority || 'none'} | Age: ${ageDays} days | Source: ${issue.source || 'manual'} | Owner: ${ownerName(issue.owner_id)}`)
    }
  } else {
    sections.push('No open Issues.')
  }

  // Financial Strategist
  sections.push('\n## Financial Strategist — Latest Analysis')
  if (data.financialAnalysis) {
    sections.push(data.financialAnalysis.summary || JSON.stringify(data.financialAnalysis.content).slice(0, 500))
  } else {
    sections.push('No recent financial analysis available.')
  }

  // BD Strategist
  sections.push('\n## BD Strategist — Latest Pipeline Analysis')
  if (data.pipelineAnalysis) {
    sections.push(data.pipelineAnalysis.summary || JSON.stringify(data.pipelineAnalysis.content).slice(0, 500))
  } else {
    sections.push('No recent pipeline analysis available.')
  }

  // Last L10 transcript
  sections.push('\n## Last L10 Meeting Summary')
  if (data.lastL10Transcript) {
    const payload = data.lastL10Transcript.payload
    sections.push(`Date: ${data.lastL10Transcript.source_timestamp || 'unknown'}`)
    if (payload.action_items) {
      sections.push('Action items from last L10:')
      for (const item of (payload.action_items as string[]).slice(0, 10)) {
        sections.push(`  - ${item}`)
      }
    }
    if (payload.decisions) {
      sections.push('Decisions:')
      for (const d of (payload.decisions as string[]).slice(0, 5)) {
        sections.push(`  - ${d}`)
      }
    }
  } else {
    sections.push('No previous L10 transcript available.')
  }

  sections.push('\n---\nGenerate the L10 prep document. Prioritize Issues for IDS based on urgency, data quality, and business impact. Surface any patterns the team might not be discussing.')

  return sections.join('\n')
}

// =============================================
// L10 detection
// =============================================

/**
 * Check if there's an L10 meeting scheduled within the next N days.
 * Returns the meeting date if found, null otherwise.
 */
export async function detectUpcomingL10(organizationId: string, withinDays: number = 3): Promise<string | null> {
  const now = new Date()
  const futureDate = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000)

  // Check ingested calendar events tagged as L10
  const { data: calendarL10 } = await supabaseAdmin
    .from('ingested_data')
    .select('source_timestamp')
    .eq('organization_id', organizationId)
    .eq('source', 'calendar')
    .eq('data_type', 'calendar_event')
    .contains('relevance_tags', ['l10'])
    .gte('source_timestamp', now.toISOString())
    .lte('source_timestamp', futureDate.toISOString())
    .order('source_timestamp', { ascending: true })
    .limit(1)

  if (calendarL10 && calendarL10.length > 0) {
    return calendarL10[0].source_timestamp
  }

  // Fallback: check the meetings table
  const { data: meetingL10 } = await supabaseAdmin
    .from('meetings')
    .select('meeting_date')
    .eq('organization_id', organizationId)
    .eq('meeting_type', 'l10')
    .gte('meeting_date', now.toISOString())
    .lte('meeting_date', futureDate.toISOString())
    .order('meeting_date', { ascending: true })
    .limit(1)

  if (meetingL10 && meetingL10.length > 0) {
    return meetingL10[0].meeting_date
  }

  return null
}

/**
 * Check if L10 prep has already been generated for this week.
 * Prevents duplicate prep generation.
 */
export async function hasL10PrepBeenGenerated(organizationId: string): Promise<boolean> {
  // Check if we've generated a prep in the last 5 days
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

  const { count } = await supabaseAdmin
    .from('agent_outputs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('agent_id', 'ea')
    .eq('output_type', 'briefing')
    .ilike('title', 'L10 Prep%')
    .gte('created_at', fiveDaysAgo)

  return (count || 0) > 0
}
