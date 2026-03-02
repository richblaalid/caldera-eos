import { createClient } from '@supabase/supabase-js'
import { saveAgentOutput, createAgentIssue } from './agent-runtime'
import { daysAgo } from '@/lib/dates'
import { escapeSlackMrkdwn, slackDate } from '@/lib/slack-format'
import type { AgentOutputInsert } from '@/types/agents'

const esc = escapeSlackMrkdwn

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// =============================================
// Types
// =============================================

export type NudgeType = 'overdue_todo' | 'stalled_rock' | 'missed_scorecard' | 'milestone_approaching'
export type EscalationLevel = 1 | 2 | 3

export interface Nudge {
  type: NudgeType
  escalation: EscalationLevel
  targetPartnerId: string
  targetPartnerName: string
  title: string
  message: string
  itemId: string
  itemTitle: string
  daysOverdue?: number
  lastUpdateDate?: string
}

export interface NudgeResult {
  nudges: Nudge[]
  issuesCreated: number
  errors: string[]
}

// =============================================
// Main entry point
// =============================================

/**
 * Run nudge check for an organization.
 * Evaluates all overdue/stalled EOS items and produces nudges at the appropriate
 * escalation level per ADR-009:
 *   Level 1 — Gentle reminder (first occurrence)
 *   Level 2 — Direct nudge (2nd+ occurrence, with data)
 *   Level 3 — L10 escalation (auto-create Issue)
 */
export async function runNudgeCheck(organizationId: string): Promise<NudgeResult> {
  const result: NudgeResult = { nudges: [], issuesCreated: 0, errors: [] }

  // Skip weekends
  const today = new Date()
  const dayOfWeek = today.getDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return result
  }

  try {
    // Load partner profiles for name resolution
    const partnerMap = await getPartnerMap(organizationId)

    // Run all detection rules in parallel
    const [todoNudges, rockNudges, scorecardNudges, milestoneNudges] = await Promise.all([
      detectOverdueTodos(organizationId, partnerMap),
      detectStalledRocks(organizationId, partnerMap),
      detectMissedScorecard(organizationId, partnerMap),
      detectApproachingMilestones(organizationId, partnerMap),
    ])

    const allNudges = [...todoNudges, ...rockNudges, ...scorecardNudges, ...milestoneNudges]

    // Deduplicate against recent nudge history (max 1 per item per day)
    const recentNudges = await getRecentNudges(organizationId)
    const filtered = allNudges.filter(n => !recentNudges.has(n.itemId))

    // Determine escalation level based on nudge history
    for (const nudge of filtered) {
      nudge.escalation = await getEscalationLevel(organizationId, nudge.itemId)

      // Level 3: auto-create Issue for L10
      if (nudge.escalation === 3) {
        const descriptionByType: Record<NudgeType, string> = {
          overdue_todo: `To-do "${nudge.itemTitle}" has been overdue for ${nudge.daysOverdue}+ days and has been nudged multiple times without resolution. Should it carry forward, be reassigned, or dropped?`,
          stalled_rock: `Rock "${nudge.itemTitle}" hasn't shown progress in ${nudge.daysOverdue}+ days despite multiple reminders. This may indicate a blocker that needs L10 discussion.`,
          missed_scorecard: `Metric "${nudge.itemTitle}" has been missed for ${nudge.daysOverdue ? Math.round(nudge.daysOverdue / 7) : 3}+ consecutive weeks. Should we discuss whether this is the right metric or reassign ownership?`,
          milestone_approaching: `Rock milestone "${nudge.itemTitle}" is approaching deadline. Escalated for visibility.`,
        }
        await createAgentIssue(
          organizationId,
          'Ember Nudge Engine',
          `[Escalated] ${nudge.title}`,
          `Owner: ${nudge.targetPartnerName}\n\n${descriptionByType[nudge.type]}`,
          { owner_id: nudge.targetPartnerId, source: 'insight' },
        )
        result.issuesCreated++
      }

      // Store nudge in agent_outputs for history tracking
      await saveNudgeOutput(organizationId, nudge)
    }

    result.nudges = filtered
  } catch (error: unknown) {
    const err = error as { message?: string }
    result.errors.push(err.message || 'Nudge check failed')
  }

  return result
}

// =============================================
// Detection rules
// =============================================

/**
 * Detect todos past their 7-day deadline that haven't been completed.
 */
async function detectOverdueTodos(
  organizationId: string,
  partnerMap: Map<string, string>
): Promise<Nudge[]> {
  const today = new Date().toISOString().split('T')[0]

  const { data: overdue } = await supabaseAdmin
    .from('todos')
    .select('id, title, owner_id, due_date, created_at')
    .eq('organization_id', organizationId)
    .eq('completed', false)
    .lt('due_date', today)
    .order('due_date', { ascending: true })

  if (!overdue || overdue.length === 0) return []

  return overdue
    .filter(t => t.owner_id)
    .map(todo => {
      const daysOverdue = Math.floor(
        (Date.now() - new Date(todo.due_date).getTime()) / (1000 * 60 * 60 * 24)
      )
      return {
        type: 'overdue_todo' as NudgeType,
        escalation: 1 as EscalationLevel,
        targetPartnerId: todo.owner_id,
        targetPartnerName: partnerMap.get(todo.owner_id) || 'Unknown',
        title: `Overdue To-Do: ${todo.title}`,
        message: `Your To-Do "${todo.title}" is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} past its deadline. Should it carry forward or be dropped?`,
        itemId: todo.id,
        itemTitle: todo.title,
        daysOverdue,
      }
    })
}

/**
 * Detect rocks with no milestone progress in 2+ weeks.
 * A rock is "stalled" if its updated_at hasn't changed in 14+ days and it's not complete.
 */
async function detectStalledRocks(
  organizationId: string,
  partnerMap: Map<string, string>
): Promise<Nudge[]> {
  const twoWeeksAgo = daysAgo(14)

  const { data: stalled } = await supabaseAdmin
    .from('rocks')
    .select('id, title, owner_id, status, milestones, updated_at, due_date')
    .eq('organization_id', organizationId)
    .in('status', ['on_track', 'at_risk'])
    .lt('updated_at', twoWeeksAgo)

  if (!stalled || stalled.length === 0) return []

  return stalled
    .filter(r => r.owner_id)
    .map(rock => {
      const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(rock.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      )
      const milestones = (rock.milestones || []) as Array<{ title: string; completed?: boolean }>
      const completedCount = milestones.filter(m => m.completed).length
      const progressPct = milestones.length > 0
        ? Math.round((completedCount / milestones.length) * 100)
        : 0

      return {
        type: 'stalled_rock' as NudgeType,
        escalation: 1 as EscalationLevel,
        targetPartnerId: rock.owner_id,
        targetPartnerName: partnerMap.get(rock.owner_id) || 'Unknown',
        title: `Stalled Rock: ${rock.title}`,
        message: `Your Rock "${rock.title}" hasn't been updated in ${daysSinceUpdate} days (${progressPct}% milestone progress). Do you need help removing a blocker?`,
        itemId: rock.id,
        itemTitle: rock.title,
        daysOverdue: daysSinceUpdate,
        lastUpdateDate: rock.updated_at,
      }
    })
}

/**
 * Detect scorecard metrics missing entries.
 * On Mondays: flag any metric missing last week's entry (timely reminder).
 * Any day: flag metrics with 3+ consecutive weeks without an entry (escalation).
 */
async function detectMissedScorecard(
  organizationId: string,
  partnerMap: Map<string, string>
): Promise<Nudge[]> {
  // Get all active metrics
  const { data: metrics } = await supabaseAdmin
    .from('scorecard_metrics')
    .select('id, name, owner_id')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  if (!metrics || metrics.length === 0) return []

  const nudges: Nudge[] = []
  const today = new Date()
  const isMonday = today.getDay() === 1

  // Calculate last week's Monday
  const lastWeekMonday = new Date(today)
  const dayOfWeek = lastWeekMonday.getDay()
  const daysBack = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  lastWeekMonday.setDate(lastWeekMonday.getDate() - daysBack - 7)
  lastWeekMonday.setHours(0, 0, 0, 0)
  const lastWeekOf = lastWeekMonday.toISOString().split('T')[0]

  const threeWeeksAgo = new Date()
  threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21)

  for (const metric of metrics) {
    if (!metric.owner_id) continue

    // Get entries for the last 4 weeks
    const { data: entries } = await supabaseAdmin
      .from('scorecard_entries')
      .select('week_of')
      .eq('metric_id', metric.id)
      .gte('week_of', threeWeeksAgo.toISOString().split('T')[0])
      .order('week_of', { ascending: false })

    const weeksCovered = entries?.length || 0
    const consecutiveMisses = 3 - weeksCovered

    // Monday nudge: last week's entry is missing
    if (isMonday) {
      const hasLastWeek = entries?.some(e => e.week_of === lastWeekOf)
      if (!hasLastWeek) {
        nudges.push({
          type: 'missed_scorecard',
          escalation: 1 as EscalationLevel,
          targetPartnerId: metric.owner_id,
          targetPartnerName: partnerMap.get(metric.owner_id) || 'Unknown',
          title: `Missing Scorecard: ${metric.name}`,
          message: `Your metric "${metric.name}" is missing for last week. Reply with \`${metric.name}: <value>\` or enter in the dashboard.`,
          itemId: `${metric.id}:${lastWeekOf}`,
          itemTitle: metric.name,
          daysOverdue: 7,
        })
        continue // Don't double-nudge with the escalation below
      }
    }

    // Escalation: 3+ consecutive weeks missing
    if (consecutiveMisses >= 3) {
      nudges.push({
        type: 'missed_scorecard',
        escalation: 1 as EscalationLevel,
        targetPartnerId: metric.owner_id,
        targetPartnerName: partnerMap.get(metric.owner_id) || 'Unknown',
        title: `Missed Scorecard: ${metric.name}`,
        message: `Your metric "${metric.name}" hasn't been updated for ${consecutiveMisses}+ weeks. Should we discuss whether this is the right metric?`,
        itemId: metric.id,
        itemTitle: metric.name,
        daysOverdue: consecutiveMisses * 7,
      })
    }
  }

  return nudges
}

/**
 * Detect rock milestones due within 3 days.
 * Milestones are stored as JSONB array: [{ title, due_date?, completed? }]
 */
async function detectApproachingMilestones(
  organizationId: string,
  partnerMap: Map<string, string>
): Promise<Nudge[]> {
  const { data: rocks } = await supabaseAdmin
    .from('rocks')
    .select('id, title, owner_id, milestones')
    .eq('organization_id', organizationId)
    .in('status', ['on_track', 'at_risk', 'off_track'])

  if (!rocks || rocks.length === 0) return []

  const nudges: Nudge[] = []
  const threeDaysOut = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  const today = new Date()

  for (const rock of rocks) {
    if (!rock.owner_id) continue
    const milestones = (rock.milestones || []) as Array<{
      title: string
      due_date?: string
      completed?: boolean
    }>

    for (const milestone of milestones) {
      if (!milestone.due_date || milestone.completed) continue

      const dueDate = new Date(milestone.due_date)
      if (dueDate >= today && dueDate <= threeDaysOut) {
        const daysUntil = Math.ceil(
          (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
        nudges.push({
          type: 'milestone_approaching',
          escalation: 1 as EscalationLevel,
          targetPartnerId: rock.owner_id,
          targetPartnerName: partnerMap.get(rock.owner_id) || 'Unknown',
          title: `Milestone Due: ${milestone.title}`,
          message: `Your Rock "${rock.title}" has a milestone "${milestone.title}" due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}. How's it tracking?`,
          itemId: `${rock.id}:${milestone.title}`,
          itemTitle: milestone.title,
        })
      }
    }
  }

  return nudges
}

// =============================================
// Escalation logic
// =============================================

/**
 * Determine escalation level based on how many times we've nudged this item.
 * Level 1: First nudge (gentle reminder)
 * Level 2: 2nd+ nudge (direct with data)
 * Level 3: 3rd+ nudge (L10 escalation — auto-create Issue)
 */
async function getEscalationLevel(organizationId: string, itemId: string): Promise<EscalationLevel> {
  const { count } = await supabaseAdmin
    .from('agent_outputs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('agent_id', 'ea')
    .eq('output_type', 'alert')
    .contains('content', { nudge_item_id: itemId })

  const priorNudges = count || 0

  if (priorNudges >= 2) return 3
  if (priorNudges >= 1) return 2
  return 1
}

/**
 * Get item IDs that have already been nudged today (max 1 nudge per item per day).
 */
async function getRecentNudges(organizationId: string): Promise<Set<string>> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data } = await supabaseAdmin
    .from('agent_outputs')
    .select('content')
    .eq('organization_id', organizationId)
    .eq('agent_id', 'ea')
    .eq('output_type', 'alert')
    .gte('created_at', todayStart.toISOString())

  const ids = new Set<string>()
  for (const row of data || []) {
    const content = row.content as Record<string, unknown>
    if (content.nudge_item_id) {
      ids.add(content.nudge_item_id as string)
    }
  }
  return ids
}

// =============================================
// Actions
// =============================================

/**
 * Save a nudge to agent_outputs for history tracking and deduplication.
 */
async function saveNudgeOutput(organizationId: string, nudge: Nudge): Promise<void> {
  const output: AgentOutputInsert = {
    organization_id: organizationId,
    agent_id: 'ea',
    output_type: 'alert',
    title: nudge.title,
    summary: nudge.message,
    content: {
      nudge_type: nudge.type,
      nudge_item_id: nudge.itemId,
      escalation_level: nudge.escalation,
      target_partner_id: nudge.targetPartnerId,
      days_overdue: nudge.daysOverdue,
      last_update_date: nudge.lastUpdateDate,
    },
    trust_zone: nudge.escalation >= 3 ? 2 : 1,
    status: 'completed',
    target_partner: nudge.targetPartnerId,
  }
  await saveAgentOutput(output)
}

// =============================================
// Helpers
// =============================================

/**
 * Build a map of partner_id → display_name for the organization.
 */
async function getPartnerMap(organizationId: string): Promise<Map<string, string>> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name')
    .in('id', (
      await supabaseAdmin
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organizationId)
    ).data?.map(m => m.user_id) || [])

  const map = new Map<string, string>()
  for (const profile of data || []) {
    map.set(profile.id, profile.full_name || 'Unknown')
  }
  return map
}

/**
 * Format a nudge message for Slack based on escalation level.
 */
export function formatNudgeForSlack(nudge: Nudge): { text: string; blocks: Record<string, unknown>[] } {
  const emoji = {
    overdue_todo: ':white_check_mark:',
    stalled_rock: ':rock:',
    missed_scorecard: ':bar_chart:',
    milestone_approaching: ':calendar:',
  }[nudge.type]

  const levelLabel = {
    1: 'Reminder',
    2: 'Nudge',
    3: 'L10 Escalation',
  }[nudge.escalation]

  const blocks: Record<string, unknown>[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *${levelLabel}: ${esc(nudge.itemTitle)}*`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: esc(nudge.message),
      },
    },
  ]

  // Add data context for level 2+ nudges
  if (nudge.escalation >= 2) {
    const fields: string[] = []
    if (nudge.daysOverdue) fields.push(`*Days Overdue:* ${nudge.daysOverdue}`)
    if (nudge.lastUpdateDate) fields.push(`*Last Updated:* ${slackDate(nudge.lastUpdateDate, '{date_short}')}`)

    if (fields.length > 0) {
      blocks.push({
        type: 'context',
        elements: fields.map(f => ({ type: 'mrkdwn', text: f })),
      })
    }
  }

  // Add escalation warning for level 3
  if (nudge.escalation === 3) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: ':warning: _This has been escalated to the L10 Issues list for group discussion._' },
      ],
    })
  }

  return {
    text: `${levelLabel}: ${esc(nudge.itemTitle)} — ${esc(nudge.message)}`,
    blocks,
  }
}
