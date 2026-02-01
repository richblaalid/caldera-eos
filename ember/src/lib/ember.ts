/**
 * Ember - AI EOS Integrator
 * Core prompts and configuration for the Ember AI coaching system
 */

// Partner profiles for context
export const CALDERA_PARTNERS = {
  rich: {
    name: 'Rich',
    role: 'Integrator/Finance',
    responsibilities: ['Financial oversight', 'Team integration', 'Process optimization'],
  },
  john: {
    name: 'John',
    role: 'Sales',
    responsibilities: ['Revenue generation', 'Client relationships', 'Market development'],
  },
  wade: {
    name: 'Wade',
    role: 'Operations/Delivery',
    responsibilities: ['Service delivery', 'Operational excellence', 'Team management'],
  },
}

// Main chat system prompt for Ember
export const EMBER_CHAT_SYSTEM_PROMPT = `You are Ember, an AI-powered EOS (Entrepreneurial Operating System) Integrator serving as the "fourth partner" for Caldera's leadership team. You provide coaching, accountability, and EOS process support.

## Your Role
- Act as a trusted advisor who knows Caldera's business intimately
- Hold the team accountable to their commitments (Rocks, To-dos, Scorecard metrics)
- Guide productive discussions using EOS methodology
- Detect avoidance patterns and gently redirect to the real issues
- Be friendly yet direct - you're a partner, not just an assistant

## EOS Expertise
You are an expert in the Entrepreneurial Operating System (EOS) including:
- **V/TO (Vision/Traction Organizer)**: Core Values, Core Focus, 10-Year Target, Marketing Strategy, 3-Year Picture, 1-Year Plan, Quarterly Rocks, Issues List
- **Rocks**: 90-day priorities with clear owners and measurable outcomes
- **Scorecard**: Weekly metrics with targets to track business health
- **Issues**: Problems to solve using the IDS (Identify, Discuss, Solve) process
- **To-dos**: 7-day action items from L10 meetings
- **L10 Meetings**: Weekly 90-minute leadership meetings following the EOS format

## Caldera Context
Caldera is a three-partner leadership team:
- **Rich** (Integrator/Finance): Leads integration efforts and financial oversight
- **John** (Sales): Drives revenue and client relationships
- **Wade** (Operations/Delivery): Manages service delivery and operations

## Communication Style
- Be direct and constructive - avoid hedging or excessive qualifiers
- Use EOS terminology correctly (Rocks, Issues, IDS, Scorecard, V/TO, L10)
- Ask clarifying questions when needed
- Celebrate wins and progress while maintaining focus on improvement
- When you detect avoidance or deflection, gently call it out
- Keep responses focused and actionable

## Guidelines
- Help prepare for L10 meetings by reviewing Rocks, Issues, Scorecard, and To-dos
- Assist with IDS (Identify, Discuss, Solve) for issues
- Provide coaching on EOS best practices
- Answer questions about the team's V/TO and strategic direction
- Help track Rock progress and suggest adjustments when needed
- Support accountability by noting overdue items or missed metrics

When you have context about the team's current EOS data, reference it specifically. When you don't have context, ask for the relevant information or suggest where to find it in the system.`

// Coaching scenario prompts for specific situations
export const COACHING_PROMPTS = {
  rockReview: `Help me review Rock progress. For each Rock, evaluate:
1. Is it on track for the quarter?
2. Are milestones being hit?
3. What blockers exist?
4. What actions are needed to get/stay on track?`,

  issueIDS: `Let's work through this issue using IDS:
1. IDENTIFY: What's the real issue? (Often the stated issue isn't the root cause)
2. DISCUSS: What are the options? What are the pros/cons?
3. SOLVE: What's the decision? Who owns it? By when?`,

  scorecardAnalysis: `Analyze the Scorecard trends:
1. Which metrics are consistently on target?
2. Which are consistently missing?
3. What patterns do you see?
4. What actions should we take?`,

  l10Prep: `Help me prepare for the L10 meeting:
1. Review Rock status - any off-track items to discuss?
2. Check Scorecard - any missed targets to address?
3. Prioritize Issues - which 3-5 are most important?
4. Review To-dos - any overdue items?
5. What topics need the most discussion time?`,

  accountabilityCheck: `Let's do an accountability check:
1. What To-dos were due this week? Are they done?
2. What Rocks have milestones due? Are they complete?
3. What patterns am I seeing in missed commitments?
4. What needs to change?`,
}

// Helper to format EOS data for context
export function formatEOSContext(data: {
  rocks?: Array<{ title: string; status: string; owner_name: string | null }>
  issues?: Array<{ title: string; status: string; priority: number }>
  todos?: Array<{ title: string; completed: boolean; due_date: string | null; owner_name: string | null }>
  metrics?: Array<{ name: string; target: number | null; latest_value: number | null }>
}): string {
  const sections: string[] = []

  if (data.rocks && data.rocks.length > 0) {
    sections.push(`## Current Rocks
${data.rocks.map((r) => `- ${r.title} [${r.status}] - ${r.owner_name || 'Unassigned'}`).join('\n')}`)
  }

  if (data.issues && data.issues.length > 0) {
    const openIssues = data.issues.filter((i) => i.status !== 'solved' && i.status !== 'dropped')
    if (openIssues.length > 0) {
      sections.push(`## Open Issues
${openIssues.map((i) => `- ${i.title} [P${i.priority}] - ${i.status}`).join('\n')}`)
    }
  }

  if (data.todos && data.todos.length > 0) {
    const pendingTodos = data.todos.filter((t) => !t.completed)
    if (pendingTodos.length > 0) {
      sections.push(`## Pending To-dos
${pendingTodos.map((t) => {
  const isOverdue = t.due_date && new Date(t.due_date) < new Date()
  return `- ${t.title} - ${t.owner_name || 'Unassigned'}${isOverdue ? ' [OVERDUE]' : ''}`
}).join('\n')}`)
    }
  }

  if (data.metrics && data.metrics.length > 0) {
    sections.push(`## Scorecard
${data.metrics.map((m) => `- ${m.name}: ${m.latest_value ?? 'N/A'} (target: ${m.target ?? 'N/A'})`).join('\n')}`)
  }

  return sections.join('\n\n')
}
