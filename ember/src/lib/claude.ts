import Anthropic from '@anthropic-ai/sdk'

// Create a singleton Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export { anthropic }

// Ember system prompt for L10 meeting prep
export const EMBER_SYSTEM_PROMPT = `You are Ember, an AI assistant specializing in the Entrepreneurial Operating System (EOS). You serve as a "fourth partner" for Caldera's leadership team, helping them prepare for and run effective L10 meetings.

Your role is to:
- Provide clear, actionable meeting prep based on current EOS data
- Highlight Rocks that need attention (off-track or at-risk)
- Surface open Issues that should be discussed
- Note any Scorecard metrics that missed their targets
- Flag overdue To-dos that need follow-up

Be direct, constructive, and focused on helping the team have productive meetings. Use EOS terminology correctly (Rocks, Issues, IDS, Scorecard, V/TO, L10).

Format your output as structured JSON for parsing.`

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

export async function generateMeetingPrep(input: PrepInput): Promise<PrepOutput> {
  const userPrompt = `Generate meeting prep for an upcoming L10 meeting based on the following EOS data:

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

Please generate a meeting prep summary in the following JSON format:
{
  "summary": "Brief 2-3 sentence overview of what to focus on this L10",
  "rocks_update": ["List of 2-4 key points about Rocks status"],
  "issues_to_discuss": ["List of 2-4 priority issues to address in IDS"],
  "scorecard_highlights": ["List of 2-3 notable metric trends or concerns"],
  "todos_review": ["List of 2-3 to-do items needing attention"]
}

Only output valid JSON, no other text.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: EMBER_SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: userPrompt }
    ],
  })

  // Extract text content
  const textContent = message.content.find(c => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  // Parse JSON response - strip markdown code blocks if present
  let jsonText = textContent.text.trim()

  // Remove markdown code blocks (```json ... ``` or ``` ... ```)
  if (jsonText.startsWith('```')) {
    // Find the end of the first line (which might be ```json or just ```)
    const firstNewline = jsonText.indexOf('\n')
    if (firstNewline !== -1) {
      jsonText = jsonText.slice(firstNewline + 1)
    }
    // Remove trailing ```
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3)
    }
    jsonText = jsonText.trim()
  }

  try {
    const parsed = JSON.parse(jsonText)
    return {
      ...parsed,
      generated_at: new Date().toISOString(),
    }
  } catch {
    // If JSON parsing fails, create a fallback structure
    return {
      summary: textContent.text.slice(0, 200),
      rocks_update: [],
      issues_to_discuss: [],
      scorecard_highlights: [],
      todos_review: [],
      generated_at: new Date().toISOString(),
    }
  }
}
