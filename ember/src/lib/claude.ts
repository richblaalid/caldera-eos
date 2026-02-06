import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

// Ember system prompt for L10 meeting prep
export const EMBER_SYSTEM_PROMPT = `You are Ember, an AI assistant specializing in the Entrepreneurial Operating System (EOS). You serve as a "fourth partner" for Caldera's leadership team, helping them prepare for and run effective L10 meetings.

Your role is to:
- Provide clear, actionable meeting prep based on current EOS data
- Highlight Rocks that need attention (off-track or at-risk)
- Surface open Issues that should be discussed
- Note any Scorecard metrics that missed their targets
- Flag overdue To-dos that need follow-up

Be direct, constructive, and focused on helping the team have productive meetings. Use EOS terminology correctly (Rocks, Issues, IDS, Scorecard, V/TO, L10).`

// Types for prep generation
export interface PrepInput {
  rocks: Array<{
    title: string
    status: string
    owner_name: string | null
    milestones?: Array<{ title: string; completed: boolean }>
  }>
  issues: Array<{
    title: string
    status: string
    priority: number
    owner_name: string | null
  }>
  metrics: Array<{
    name: string
    target: number | null
    latest_value: number | null
    goal_direction: string
  }>
  todos: Array<{
    title: string
    owner_name: string | null
    due_date: string | null
    completed: boolean
  }>
}

export interface PrepOutput {
  summary: string
  rocks_update: string[]
  issues_to_discuss: string[]
  scorecard_highlights: string[]
  todos_review: string[]
  generated_at: string
}

// Zod schema for structured output
const prepOutputSchema = z.object({
  summary: z.string().describe('Brief 2-3 sentence overview of what to focus on this L10'),
  rocks_update: z.array(z.string()).describe('List of 2-4 key points about Rocks status'),
  issues_to_discuss: z.array(z.string()).describe('List of 2-4 priority issues to address in IDS'),
  scorecard_highlights: z.array(z.string()).describe('List of 2-3 notable metric trends or concerns'),
  todos_review: z.array(z.string()).describe('List of 2-3 to-do items needing attention'),
})

function buildPrepPrompt(input: PrepInput): string {
  return `Generate meeting prep for an upcoming L10 meeting based on the following EOS data:

## Current Rocks (${input.rocks.length} total)
${input.rocks.map(r => `- ${r.title} [${r.status}] - ${r.owner_name || 'Unassigned'}`).join('\n') || 'No rocks'}

## Open Issues (${input.issues.filter(i => i.status !== 'solved' && i.status !== 'dropped').length} total)
${input.issues
  .filter(i => i.status !== 'solved' && i.status !== 'dropped')
  .map(i => `- ${i.title} [${i.status}] P${i.priority} - ${i.owner_name || 'Unassigned'}`)
  .join('\n') || 'No open issues'}

## Scorecard Metrics
${input.metrics.map(m => {
  const status = m.latest_value !== null && m.target !== null
    ? (m.goal_direction === 'above' && m.latest_value >= m.target) ||
      (m.goal_direction === 'below' && m.latest_value <= m.target) ||
      (m.goal_direction === 'equal' && m.latest_value === m.target)
      ? 'ON TARGET'
      : 'MISSED'
    : 'NO DATA'
  return `- ${m.name}: ${m.latest_value ?? 'N/A'} (target: ${m.target ?? 'N/A'}) [${status}]`
}).join('\n') || 'No metrics'}

## Pending To-dos (${input.todos.filter(t => !t.completed).length} total)
${input.todos
  .filter(t => !t.completed)
  .map(t => {
    const isOverdue = t.due_date && new Date(t.due_date) < new Date()
    return `- ${t.title} - ${t.owner_name || 'Unassigned'}${t.due_date ? ` (due: ${t.due_date})` : ''}${isOverdue ? ' [OVERDUE]' : ''}`
  })
  .join('\n') || 'No pending to-dos'}

Generate a meeting prep summary highlighting what needs attention.`
}

export async function generateMeetingPrep(input: PrepInput): Promise<PrepOutput> {
  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    system: EMBER_SYSTEM_PROMPT,
    prompt: buildPrepPrompt(input),
    schema: prepOutputSchema,
  })

  return {
    ...object,
    generated_at: new Date().toISOString(),
  }
}
