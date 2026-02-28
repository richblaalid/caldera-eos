import { createClient } from '@supabase/supabase-js'
import { saveAgentOutput } from './agent-runtime'
import type { AgentOutputInsert } from '@/types/agents'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================
// Types
// ============================================

export type PatternSeverity = 'observation' | 'concern' | 'escalation'

export interface PatternAlert {
  pattern_type: string
  severity: PatternSeverity
  title: string
  detail: string
  data_points: Array<{ label: string; value: string }>
  recommended_action: string
  eos_construct: string // rock, scorecard, issue, todo, financial
}

// ============================================
// Thresholds
// ============================================

const THRESHOLDS = {
  stalledRockWeeks: 3,
  consecutiveScorecardMisses: 3,
  topicAvoidanceWeeks: 4,
  workloadImbalanceMultiplier: 2,
}

// ============================================
// Main entry point
// ============================================

/**
 * Run pattern detection — pure data queries, no LLM.
 * Detects behavioral gaps between what's said and what's happening.
 */
export async function runPatternDetection(organizationId: string): Promise<PatternAlert[]> {
  const alerts: PatternAlert[] = []

  const results = await Promise.all([
    detectStalledRocks(organizationId),
    detectScorecardMissesWithoutIssues(organizationId),
    detectTopicAvoidance(organizationId),
    detectUntrackedCommitments(organizationId),
    detectConcentrationWorsening(organizationId),
    detectWorkloadImbalance(organizationId),
  ])

  for (const result of results) {
    alerts.push(...result)
  }

  // Save as agent output for briefing consumption
  if (alerts.length > 0) {
    const output: AgentOutputInsert = {
      organization_id: organizationId,
      agent_id: 'pattern-detector',
      output_type: 'analysis',
      title: `Pattern Detection — ${new Date().toISOString().split('T')[0]}`,
      summary: `${alerts.length} pattern(s) detected: ${alerts.filter(a => a.severity === 'escalation').length} escalation, ${alerts.filter(a => a.severity === 'concern').length} concern, ${alerts.filter(a => a.severity === 'observation').length} observation`,
      content: { alerts } as unknown as Record<string, unknown>,
      trust_zone: 1,
      status: 'completed',
    }
    await saveAgentOutput(output)
  }

  // Auto-create Issues for escalation-severity alerts
  for (const alert of alerts.filter(a => a.severity === 'escalation')) {
    await createPatternIssue(organizationId, alert)
  }

  return alerts
}

// ============================================
// Pattern 1: Stalled Rock marked "on track"
// ============================================

async function detectStalledRocks(organizationId: string): Promise<PatternAlert[]> {
  const { data: rocks } = await supabaseAdmin
    .from('rocks')
    .select('id, title, status, owner_id, milestones, updated_at')
    .eq('organization_id', organizationId)
    .eq('status', 'on_track')

  if (!rocks || rocks.length === 0) return []

  const alerts: PatternAlert[] = []
  const now = Date.now()
  const thresholdMs = THRESHOLDS.stalledRockWeeks * 7 * 24 * 60 * 60 * 1000

  for (const rock of rocks) {
    const milestones = (rock.milestones as Array<{ title: string; completed: boolean; completed_at?: string }>) || []
    if (milestones.length === 0) continue

    // Find the most recent milestone completion
    const completedMilestones = milestones
      .filter(m => m.completed && m.completed_at)
      .map(m => new Date(m.completed_at!).getTime())

    // If no milestones completed at all, use the rock's updated_at as fallback
    const lastProgress = completedMilestones.length > 0
      ? Math.max(...completedMilestones)
      : new Date(rock.updated_at).getTime()

    const daysSinceProgress = Math.floor((now - lastProgress) / (1000 * 60 * 60 * 24))

    if (now - lastProgress > thresholdMs) {
      const completedCount = milestones.filter(m => m.completed).length
      alerts.push({
        pattern_type: 'stalled_rock',
        severity: 'concern',
        title: `Stalled Rock: "${rock.title}" marked on-track but no progress in ${daysSinceProgress} days`,
        detail: `${completedCount}/${milestones.length} milestones completed. Last progress ${daysSinceProgress} days ago. Status says "on track" but milestones tell a different story.`,
        data_points: [
          { label: 'Rock', value: rock.title },
          { label: 'Days since progress', value: String(daysSinceProgress) },
          { label: 'Milestones', value: `${completedCount}/${milestones.length}` },
        ],
        recommended_action: `Review with owner — is this truly on track? Consider updating status or adding a supporting To-do.`,
        eos_construct: 'rock',
      })
    }
  }

  return alerts
}

// ============================================
// Pattern 2: Scorecard miss with no Issue
// ============================================

async function detectScorecardMissesWithoutIssues(organizationId: string): Promise<PatternAlert[]> {
  // Get active metrics with their entries (last 4 weeks)
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [metricsResult, entriesResult, issuesResult] = await Promise.all([
    supabaseAdmin
      .from('scorecard_metrics')
      .select('id, name, target, goal_direction, owner_id')
      .eq('organization_id', organizationId)
      .eq('is_active', true),
    supabaseAdmin
      .from('scorecard_entries')
      .select('metric_id, value, week_of')
      .eq('organization_id', organizationId)
      .gte('week_of', fourWeeksAgo)
      .order('week_of', { ascending: true }),
    supabaseAdmin
      .from('issues')
      .select('title, status')
      .eq('organization_id', organizationId)
      .eq('status', 'open'),
  ])

  const metrics = metricsResult.data || []
  const entries = entriesResult.data || []
  const openIssues = issuesResult.data || []

  const alerts: PatternAlert[] = []

  for (const metric of metrics) {
    if (metric.target === null) continue

    const metricEntries = entries
      .filter(e => e.metric_id === metric.id)
      .sort((a, b) => (a.week_of as string).localeCompare(b.week_of as string))

    // Count consecutive misses from the latest entry backwards
    const consecutiveMisses = metricEntries.reduceRight((acc, entry) => {
      if (acc.done) return acc
      const val = entry.value as number
      const isAbove = metric.goal_direction === 'above'
      const missed = isAbove ? val < (metric.target as number) : val > (metric.target as number)
      if (missed) return { count: acc.count + 1, done: false }
      return { ...acc, done: true }
    }, { count: 0, done: false }).count

    if (consecutiveMisses < THRESHOLDS.consecutiveScorecardMisses) continue

    // Check if there's an existing open Issue mentioning this metric
    const metricNameLower = metric.name.toLowerCase()
    const hasIssue = openIssues.some(i =>
      (i.title as string).toLowerCase().includes(metricNameLower)
    )

    if (!hasIssue) {
      alerts.push({
        pattern_type: 'scorecard_miss_no_issue',
        severity: 'concern',
        title: `"${metric.name}" missed ${consecutiveMisses} consecutive weeks — no Issue created`,
        detail: `Target: ${metric.target}. This metric has been below target for ${consecutiveMisses} weeks straight, but no one has created an Issue to IDS it. Is the team avoiding the conversation?`,
        data_points: [
          { label: 'Metric', value: metric.name },
          { label: 'Target', value: String(metric.target) },
          { label: 'Consecutive misses', value: String(consecutiveMisses) },
          { label: 'Latest value', value: metricEntries.length > 0 ? String(metricEntries[metricEntries.length - 1].value) : 'N/A' },
        ],
        recommended_action: `Create an Issue for L10 IDS. ${consecutiveMisses} consecutive misses without discussion is a pattern worth addressing.`,
        eos_construct: 'scorecard',
      })
    }
  }

  return alerts
}

// ============================================
// Pattern 3: Topic avoidance
// ============================================

async function detectTopicAvoidance(organizationId: string): Promise<PatternAlert[]> {
  const thresholdDate = new Date(Date.now() - THRESHOLDS.topicAvoidanceWeeks * 7 * 24 * 60 * 60 * 1000).toISOString()

  // Get active rocks and open issues
  const [rocksResult, issuesResult, transcriptsResult] = await Promise.all([
    supabaseAdmin
      .from('rocks')
      .select('id, title, status, owner_id')
      .eq('organization_id', organizationId)
      .in('status', ['on_track', 'off_track', 'at_risk']),
    supabaseAdmin
      .from('issues')
      .select('id, title, status')
      .eq('organization_id', organizationId)
      .eq('status', 'open'),
    supabaseAdmin
      .from('ingested_data')
      .select('payload')
      .eq('organization_id', organizationId)
      .eq('source', 'grain')
      .eq('data_type', 'transcript_summary')
      .gte('source_timestamp', thresholdDate)
      .limit(50),
  ])

  const rocks = rocksResult.data || []
  const issues = issuesResult.data || []
  const transcripts = transcriptsResult.data || []

  if (transcripts.length === 0) return [] // No transcripts to check against

  // Build searchable text from all recent transcripts
  const transcriptText = transcripts
    .map(t => {
      const p = t.payload as Record<string, unknown>
      return [
        p.summary || '',
        ...(p.key_points as string[] || []),
        ...(p.action_items as string[] || []),
        ...(p.decisions as string[] || []),
      ].join(' ')
    })
    .join(' ')
    .toLowerCase()

  const alerts: PatternAlert[] = []

  // Check rocks not mentioned in any transcript
  for (const rock of rocks) {
    // Extract key words from rock title (skip common words)
    const keywords = extractKeywords(rock.title)
    const mentioned = keywords.some(kw => transcriptText.includes(kw.toLowerCase()))

    if (!mentioned) {
      alerts.push({
        pattern_type: 'topic_avoidance',
        severity: 'observation',
        title: `Rock "${rock.title}" not discussed in ${THRESHOLDS.topicAvoidanceWeeks}+ weeks`,
        detail: `This Rock hasn't been mentioned in any meeting transcript for at least ${THRESHOLDS.topicAvoidanceWeeks} weeks. Is it still relevant? Is the team avoiding it?`,
        data_points: [
          { label: 'Rock', value: rock.title },
          { label: 'Status', value: rock.status as string },
          { label: 'Weeks without mention', value: `${THRESHOLDS.topicAvoidanceWeeks}+` },
        ],
        recommended_action: `Bring this up in the next L10. Either discuss progress or drop the Rock if it's no longer a priority.`,
        eos_construct: 'rock',
      })
    }
  }

  // Check critical issues not mentioned
  for (const issue of issues) {
    const keywords = extractKeywords(issue.title)
    const mentioned = keywords.some(kw => transcriptText.includes(kw.toLowerCase()))

    if (!mentioned) {
      alerts.push({
        pattern_type: 'topic_avoidance',
        severity: 'observation',
        title: `Issue "${issue.title}" not discussed in ${THRESHOLDS.topicAvoidanceWeeks}+ weeks`,
        detail: `This open Issue hasn't come up in any meeting transcript recently. Either IDS it or close it.`,
        data_points: [
          { label: 'Issue', value: issue.title },
          { label: 'Status', value: issue.status as string },
          { label: 'Weeks without mention', value: `${THRESHOLDS.topicAvoidanceWeeks}+` },
        ],
        recommended_action: `Review in L10 — if it's been open and undiscussed for this long, it's either not important (drop it) or being avoided (IDS it).`,
        eos_construct: 'issue',
      })
    }
  }

  return alerts
}

// ============================================
// Pattern 4: Untracked commitments
// ============================================

async function detectUntrackedCommitments(organizationId: string): Promise<PatternAlert[]> {
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  // Get action items from recent transcripts
  const { data: transcripts } = await supabaseAdmin
    .from('ingested_data')
    .select('payload, source_timestamp')
    .eq('organization_id', organizationId)
    .eq('source', 'grain')
    .eq('data_type', 'transcript_summary')
    .gte('source_timestamp', twoWeeksAgo)
    .order('source_timestamp', { ascending: false })
    .limit(20)

  if (!transcripts || transcripts.length === 0) return []

  // Extract action items from transcripts
  const actionItems: Array<{ text: string; meeting: string; date: string }> = []
  for (const t of transcripts) {
    const p = t.payload as Record<string, unknown>
    const items = (p.action_items as string[]) || []
    for (const item of items) {
      actionItems.push({
        text: item,
        meeting: (p.meeting_title as string) || 'Unknown meeting',
        date: t.source_timestamp || '',
      })
    }
  }

  if (actionItems.length === 0) return []

  // Get recent todos to cross-reference
  const { data: todos } = await supabaseAdmin
    .from('todos')
    .select('title')
    .eq('organization_id', organizationId)
    .gte('created_at', twoWeeksAgo)

  const todoTitles = (todos || []).map(t => (t.title as string).toLowerCase())

  // Find action items without matching todos (fuzzy match)
  const untracked = actionItems.filter(ai => {
    return !todoTitles.some(tt => {
      const aiKeywords = extractKeywords(ai.text)
      return aiKeywords.some(kw => tt.includes(kw.toLowerCase()))
    })
  })

  if (untracked.length === 0) return []

  // Cap at 5 to avoid noise
  const topUntracked = untracked.slice(0, 5)

  return [{
    pattern_type: 'untracked_commitments',
    severity: 'observation',
    title: `${untracked.length} meeting commitment(s) without matching To-dos`,
    detail: `Action items from recent meetings don't have corresponding To-dos in Ember. Commitments made in meetings should become To-dos for accountability.`,
    data_points: topUntracked.map(ai => ({
      label: ai.meeting,
      value: ai.text,
    })),
    recommended_action: `Review these commitments and create To-dos for any that are still actionable.`,
    eos_construct: 'todo',
  }]
}

// ============================================
// Pattern 5: Concentration worsening
// ============================================

async function detectConcentrationWorsening(organizationId: string): Promise<PatternAlert[]> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Get Financial Strategist analysis for concentration data
  const { data } = await supabaseAdmin
    .from('agent_outputs')
    .select('content')
    .eq('organization_id', organizationId)
    .eq('agent_id', 'financial-strategist')
    .eq('output_type', 'analysis')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!data || data.length === 0) return []

  const content = data[0].content as Record<string, unknown>
  const concentration = content.revenue_concentration as {
    anchor_client_pct?: number
    trend_indicator?: string
  } | undefined

  if (!concentration?.anchor_client_pct) return []

  // Only alert if concentration is above 70% AND trending up
  if (concentration.anchor_client_pct > 70 && concentration.trend_indicator === '↑') {
    return [{
      pattern_type: 'concentration_worsening',
      severity: 'escalation',
      title: `Revenue concentration at ${concentration.anchor_client_pct}% and increasing`,
      detail: `Anchor client concentration has risen above 70% and is trending upward. This is an existential risk that needs L10 IDS immediately.`,
      data_points: [
        { label: 'Anchor client %', value: `${concentration.anchor_client_pct}%` },
        { label: 'Trend', value: concentration.trend_indicator },
      ],
      recommended_action: `Escalate to L10 IDS. Review pipeline for diversification progress. Consider adding a quarterly Rock for revenue diversification if one doesn't exist.`,
      eos_construct: 'financial',
    }]
  }

  return []
}

// ============================================
// Pattern 6: Partner workload imbalance
// ============================================

async function detectWorkloadImbalance(organizationId: string): Promise<PatternAlert[]> {
  // Get overdue items by owner
  const { data: overdueTodos } = await supabaseAdmin
    .from('todos')
    .select('owner_id, title, due_date')
    .eq('organization_id', organizationId)
    .eq('completed', false)
    .lt('due_date', new Date().toISOString().split('T')[0])

  if (!overdueTodos || overdueTodos.length < 2) return []

  // Get owner names
  const { data: members } = await supabaseAdmin
    .from('organization_members')
    .select('user_id, profiles(name)')
    .eq('organization_id', organizationId)

  const nameMap = new Map<string, string>()
  for (const m of members || []) {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
    const name = (profile as { name: string | null } | undefined)?.name
    if (name) nameMap.set(m.user_id, name.split(' ')[0])
  }

  // Count overdue items per owner
  const ownerCounts = new Map<string, number>()
  for (const todo of overdueTodos) {
    if (!todo.owner_id) continue
    ownerCounts.set(todo.owner_id, (ownerCounts.get(todo.owner_id) || 0) + 1)
  }

  if (ownerCounts.size < 2) return []

  const counts = Array.from(ownerCounts.entries())
  const max = counts.reduce((a, b) => a[1] > b[1] ? a : b)
  const min = counts.reduce((a, b) => a[1] < b[1] ? a : b)

  if (max[1] >= min[1] * THRESHOLDS.workloadImbalanceMultiplier && max[1] >= 3) {
    const maxName = nameMap.get(max[0]) || 'Unknown'
    const minName = nameMap.get(min[0]) || 'Unknown'

    return [{
      pattern_type: 'workload_imbalance',
      severity: 'observation',
      title: `${maxName} has ${max[1]} overdue items vs. ${minName}'s ${min[1]}`,
      detail: `${maxName} has ${THRESHOLDS.workloadImbalanceMultiplier}x+ more overdue To-dos than ${minName}. Either ${maxName} is overloaded, or accountability levels differ across partners.`,
      data_points: counts.map(([id, count]) => ({
        label: nameMap.get(id) || id,
        value: `${count} overdue`,
      })),
      recommended_action: `Discuss workload distribution in L10. Are To-dos being distributed fairly? Is one partner struggling to deliver?`,
      eos_construct: 'todo',
    }]
  }

  return []
}

// ============================================
// Helpers
// ============================================

/** Extract meaningful keywords from a title (skip common words) */
function extractKeywords(title: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'up', 'out',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'just', 'because', 'as', 'until', 'while', 'about', 'between', 'through',
    'during', 'before', 'after', 'above', 'below', 'it', 'its', 'this', 'that',
    'these', 'those', 'we', 'our', 'us', 'q1', 'q2', 'q3', 'q4',
  ])

  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
}

/** Create an Issue for escalation-severity pattern alerts (with duplicate check) */
async function createPatternIssue(organizationId: string, alert: PatternAlert) {
  const title = `[Pattern] ${alert.title}`

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
    description: `[Auto-generated by Pattern Detection Engine]\n\n${alert.detail}\n\nRecommended action: ${alert.recommended_action}`,
    status: 'open',
    priority: 'high',
    created_by: null,
  })
}
