import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { saveAgentOutput, createAgentIssue, createAgentTodo } from './agent-runtime'
import { escapeSlackMrkdwn } from '@/lib/slack-format'
import type { AgentOutputInsert } from '@/types/agents'
import type { ExtractionResult } from '@/lib/transcripts'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const esc = escapeSlackMrkdwn

// =============================================
// Schema
// =============================================

const l10RecapSchema = z.object({
  headline: z.string().describe('One-line summary of the L10 meeting outcome'),

  decisions: z.array(z.object({
    text: z.string().describe('What was decided'),
  })).describe('Decisions made during the meeting'),

  ids_outcomes: z.array(z.object({
    issue: z.string().describe('The issue that was discussed'),
    resolution: z.string().describe('How it was resolved — solved, to-do created, tabled, or still open'),
  })).describe('Issues that went through the IDS process'),

  action_items: z.array(z.object({
    text: z.string().describe('The action item or to-do'),
    owner: z.string().optional().describe('Name of the person responsible, if mentioned'),
    due_context: z.string().optional().describe('Any deadline or timing context mentioned'),
  })).describe('Action items and to-dos from the meeting').max(10),

  rock_updates: z.array(z.object({
    rock: z.string().describe('Name or description of the Rock'),
    status_change: z.string().optional().describe('Any status update mentioned — on track, off track, complete, etc.'),
  })).describe('Rock status updates discussed'),

  key_points: z.array(z.string()).describe('Other notable discussion points not captured above').max(5),
})

export type L10Recap = z.infer<typeof l10RecapSchema>

// =============================================
// Noise guard constants
// =============================================

const MAX_ISSUES_PER_L10 = 5
const MAX_TODOS_PER_L10 = 5
const AGENT_SOURCE = 'L10 Recap'

// =============================================
// Main entry point
// =============================================

export interface L10RecapResult {
  recap: L10Recap
  outputId: string | null
  issuesCreated: number
  todosCreated: number
  /** Items created, grouped by owner for DM delivery */
  itemsByOwner: Map<string, Array<{ type: 'issue' | 'todo'; title: string; dueDate?: string }>>
}

/**
 * Generate an L10 recap from a transcript, extract EOS items, and create them.
 */
export async function generateL10Recap(
  organizationId: string,
  transcriptId: string,
): Promise<L10RecapResult> {
  // Load transcript
  const { data: transcript } = await supabaseAdmin
    .from('transcripts')
    .select('id, title, full_text, extractions, meeting_date, participants')
    .eq('id', transcriptId)
    .single()

  if (!transcript) throw new Error(`Transcript ${transcriptId} not found`)

  // Build prompt with transcript text + any Grain AI extractions
  const extractions = transcript.extractions as ExtractionResult | null
  const prompt = buildRecapPrompt(transcript.full_text, extractions, transcript.title)

  const model = process.env.AGENT_DEFAULT_MODEL || 'claude-sonnet-4-20250514'

  const { object: recap } = await generateObject({
    model: anthropic(model),
    schema: l10RecapSchema,
    prompt,
    system: `You are Ember, the AI Integrator for Caldera — a 14-person software services company running on EOS.

Your job is to generate a concise L10 meeting recap from the transcript. Extract only items that were explicitly stated — decisions that were made, action items that were assigned, and issues that went through IDS. Do NOT infer or hallucinate items that weren't discussed.

Focus on:
- Decisions: What the team agreed to do
- IDS outcomes: Issues that were identified, discussed, and solved (or tabled)
- Action items: Specific to-dos with owners when mentioned
- Rock updates: Any changes to quarterly Rock status`,
  })

  // Save recap as agent_output
  const output: AgentOutputInsert = {
    organization_id: organizationId,
    agent_id: 'ea',
    output_type: 'l10_recap',
    title: `L10 Recap — ${transcript.meeting_date?.split('T')[0] || new Date().toISOString().split('T')[0]}`,
    summary: recap.headline,
    content: { ...recap, transcript_id: transcriptId } as unknown as Record<string, unknown>,
    trust_zone: 1,
    status: 'completed',
  }
  const outputId = await saveAgentOutput(output)

  // Create EOS items with noise guards
  const ownerMap = await getOwnerMap(organizationId)
  const { issuesCreated, todosCreated, itemsByOwner } = await createEosItems(
    organizationId,
    recap,
    extractions,
    ownerMap,
  )

  return { recap, outputId, issuesCreated, todosCreated, itemsByOwner }
}

// =============================================
// EOS item creation with noise guards
// =============================================

async function createEosItems(
  organizationId: string,
  recap: L10Recap,
  extractions: ExtractionResult | null,
  ownerMap: Map<string, { id: string; name: string }>,
): Promise<{
  issuesCreated: number
  todosCreated: number
  itemsByOwner: Map<string, Array<{ type: 'issue' | 'todo'; title: string; dueDate?: string }>>
}> {
  let issuesCreated = 0
  let todosCreated = 0
  const itemsByOwner = new Map<string, Array<{ type: 'issue' | 'todo'; title: string; dueDate?: string }>>()

  const addItem = (ownerId: string | undefined, item: { type: 'issue' | 'todo'; title: string; dueDate?: string }) => {
    const key = ownerId || 'unassigned'
    const items = itemsByOwner.get(key) || []
    items.push(item)
    itemsByOwner.set(key, items)
  }

  // Create Issues from IDS outcomes that are still open
  const openIssues = recap.ids_outcomes.filter(o =>
    /open|unresolved|tabled|needs follow/i.test(o.resolution)
  )

  // Also merge in Grain extraction issues (if not duplicates)
  const allIssues = [...openIssues.map(o => o.issue)]
  if (extractions?.issues) {
    for (const ei of extractions.issues) {
      if (!allIssues.some(t => t.toLowerCase().includes(ei.title.toLowerCase().slice(0, 30)))) {
        allIssues.push(ei.title)
      }
    }
  }

  for (const issueTitle of allIssues.slice(0, MAX_ISSUES_PER_L10)) {
    await createAgentIssue(
      organizationId,
      AGENT_SOURCE,
      issueTitle,
      'Surfaced during L10 IDS discussion.',
      { source: 'insight' },
    )
    issuesCreated++
    addItem(undefined, { type: 'issue', title: issueTitle })
  }

  // Create To-dos from action items
  const actionItems = recap.action_items.slice(0, MAX_TODOS_PER_L10)

  // Also merge in Grain extraction todos
  if (extractions?.todos) {
    for (const et of extractions.todos) {
      if (actionItems.length >= MAX_TODOS_PER_L10) break
      if (!actionItems.some(a => a.text.toLowerCase().includes(et.title.toLowerCase().slice(0, 30)))) {
        actionItems.push({ text: et.title, owner: et.owner })
      }
    }
  }

  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 7)
  const dueDateStr = dueDate.toISOString().split('T')[0]

  for (const item of actionItems) {
    const ownerId = item.owner ? resolveOwner(item.owner, ownerMap) : undefined

    await createAgentTodo(
      organizationId,
      AGENT_SOURCE,
      item.text,
      item.due_context || 'From L10 meeting discussion.',
      {
        owner_id: ownerId || null,
        due_date: dueDateStr,
      },
    )
    todosCreated++
    addItem(ownerId, { type: 'todo', title: item.text, dueDate: dueDateStr })
  }

  return { issuesCreated, todosCreated, itemsByOwner }
}

// =============================================
// Dedup check
// =============================================

/**
 * Check if an L10 recap has already been generated for this transcript.
 */
export async function hasL10RecapBeenGenerated(
  organizationId: string,
  transcriptId: string,
): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from('agent_outputs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('agent_id', 'ea')
    .eq('output_type', 'l10_recap')
    .contains('content', { transcript_id: transcriptId })

  return (count || 0) > 0
}

// =============================================
// Slack formatting
// =============================================

/**
 * Format L10 recap as Slack Block Kit blocks for #caldera-eos channel.
 */
export function formatL10RecapBlocks(
  recap: L10Recap,
  itemCounts: { issuesCreated: number; todosCreated: number },
): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'L10 Recap', emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: esc(recap.headline) },
    },
  ]

  // Decisions
  if (recap.decisions.length > 0) {
    const items = recap.decisions.map(d => `*>*  ${esc(d.text)}`).join('\n')
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Decisions*\n${items}` },
    })
  }

  // IDS Outcomes
  if (recap.ids_outcomes.length > 0) {
    const items = recap.ids_outcomes
      .map(o => `*>*  ${esc(o.issue)} — _${esc(o.resolution)}_`)
      .join('\n')
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*IDS Outcomes*\n${items}` },
    })
  }

  // Action Items
  if (recap.action_items.length > 0) {
    const items = recap.action_items
      .map(a => {
        const owner = a.owner ? ` (${esc(a.owner)})` : ''
        return `*>*  ${esc(a.text)}${owner}`
      })
      .join('\n')
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Action Items*\n${items}` },
    })
  }

  // Rock Updates
  if (recap.rock_updates.length > 0) {
    const items = recap.rock_updates
      .map(r => `*>*  ${esc(r.rock)}${r.status_change ? ` — _${esc(r.status_change)}_` : ''}`)
      .join('\n')
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Rock Updates*\n${items}` },
    })
  }

  // Footer with auto-created items
  if (itemCounts.issuesCreated > 0 || itemCounts.todosCreated > 0) {
    const parts: string[] = []
    if (itemCounts.issuesCreated > 0) parts.push(`${itemCounts.issuesCreated} issue${itemCounts.issuesCreated > 1 ? 's' : ''}`)
    if (itemCounts.todosCreated > 0) parts.push(`${itemCounts.todosCreated} to-do${itemCounts.todosCreated > 1 ? 's' : ''}`)
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `_Auto-created ${parts.join(' and ')} from this L10. Check your DMs for your personal action items._` }],
    })
  }

  return blocks
}

/**
 * Format personal action items for a partner's DM.
 */
export function formatPersonalL10Blocks(
  partnerName: string,
  items: Array<{ type: 'issue' | 'todo'; title: string; dueDate?: string }>,
): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Your L10 Action Items', emoji: true },
    },
  ]

  const todos = items.filter(i => i.type === 'todo')
  const issues = items.filter(i => i.type === 'issue')

  if (todos.length > 0) {
    const list = todos
      .map(t => `*>*  ${esc(t.title)}${t.dueDate ? ` _(due ${t.dueDate})_` : ''}`)
      .join('\n')
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*To-dos assigned to you:*\n${list}` },
    })
  }

  if (issues.length > 0) {
    const list = issues.map(i => `*>*  ${esc(i.title)}`).join('\n')
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Issues created for L10:*\n${list}` },
    })
  }

  return blocks
}

// =============================================
// Helpers
// =============================================

function resolveOwner(
  name: string,
  ownerMap: Map<string, { id: string; name: string }>,
): string | undefined {
  const lower = name.toLowerCase().trim()
  for (const [id, profile] of ownerMap) {
    const profileName = profile.name.toLowerCase()
    // Match on first name or full name
    if (profileName === lower || profileName.startsWith(lower) || lower.startsWith(profileName.split(' ')[0])) {
      return id
    }
  }
  return undefined
}

async function getOwnerMap(organizationId: string): Promise<Map<string, { id: string; name: string }>> {
  const { data: members } = await supabaseAdmin
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)

  if (!members || members.length === 0) return new Map()

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, name')
    .in('id', members.map(m => m.user_id))

  const map = new Map<string, { id: string; name: string }>()
  for (const p of profiles || []) {
    map.set(p.id, { id: p.id, name: p.name || 'Unknown' })
  }
  return map
}

function buildRecapPrompt(
  fullText: string,
  extractions: ExtractionResult | null,
  title: string,
): string {
  const sections: string[] = []

  sections.push(`# L10 Meeting Transcript: ${title}`)
  sections.push('')

  // Include Grain AI extractions as hints
  if (extractions) {
    if (extractions.decisions.length > 0) {
      sections.push('## Pre-extracted Decisions (from Grain AI)')
      for (const d of extractions.decisions) {
        sections.push(`- ${d.title}`)
      }
      sections.push('')
    }
    if (extractions.todos.length > 0) {
      sections.push('## Pre-extracted Action Items (from Grain AI)')
      for (const t of extractions.todos) {
        sections.push(`- ${t.title}${t.owner ? ` (${t.owner})` : ''}`)
      }
      sections.push('')
    }
    if (extractions.issues.length > 0) {
      sections.push('## Pre-extracted Issues (from Grain AI)')
      for (const i of extractions.issues) {
        sections.push(`- ${i.title}`)
      }
      sections.push('')
    }
  }

  // Truncate transcript to fit context window (keep first ~15k chars)
  const maxTranscriptLen = 15000
  const truncatedText = fullText.length > maxTranscriptLen
    ? fullText.slice(0, maxTranscriptLen) + '\n\n[Transcript truncated for length]'
    : fullText

  sections.push('## Full Transcript')
  sections.push(truncatedText)
  sections.push('')
  sections.push('---')
  sections.push('Generate the L10 recap. Only include items explicitly discussed in the transcript. Do not infer or hallucinate.')

  return sections.join('\n')
}
