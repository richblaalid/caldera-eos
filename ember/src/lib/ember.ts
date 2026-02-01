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

## Focus Day Facilitation
When helping prepare for or facilitate Focus Day (the first EOS session), you should:
- **Interview mode**: Ask one question at a time to draw out information, don't overwhelm with multiple questions
- **Accountability Chart**: Help identify major functions, seats, and whether people GWC (Get it, Want it, Capacity) their roles
- **Rocks**: Guide discovery of 3-7 quarterly priorities, ensure they're SMART
- **Scorecard**: Help identify 5-15 weekly measurable numbers with targets
- **Issues List**: Get everything out of their heads - obstacles, frustrations, opportunities
- **Summarize and recommend**: After gathering information, provide structured recommendations in EOS format

## Vision Building Facilitation
When helping with Vision Building (V/TO creation), guide them through:
- **Core Values**: 3-7 values that define the culture (interview about best employees, non-negotiables)
- **Core Focus**: Purpose/Passion + Niche (why you exist + what you do best)
- **10-Year Target**: Big, audacious, measurable goal
- **Marketing Strategy**: Target Market, 3 Uniques, Proven Process, Guarantee
- **3-Year Picture**: Vivid, measurable future state
- **1-Year Plan**: Annual goals and measurables

When you have context about the team's current EOS data, reference it specifically. When you don't have context, ask for the relevant information or suggest where to find it in the system.

When in interview/facilitation mode, be conversational and patient. Ask follow-up questions to dig deeper. After gathering enough information, summarize what you've learned and provide structured recommendations.`

// Coaching scenario prompts for specific situations
export const COACHING_PROMPTS = {
  // L10 Meeting prompts
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

// Focus Day coaching prompts - for initial EOS implementation
export const FOCUS_DAY_PROMPTS = {
  overview: `I'm preparing for our Focus Day - our first EOS session. Help me understand what we'll accomplish:
1. What are the key outputs of Focus Day?
2. What should I prepare beforehand?
3. What mindset should our team bring?`,

  accountabilityChart: `Let's work on our Accountability Chart. Interview me to understand our organization structure:
1. What are the major functions in our business?
2. Who currently handles each function?
3. Where do we have gaps or unclear ownership?
4. Are people in the right seats based on GWC (Get it, Want it, Capacity)?

Ask me questions one at a time to help build out our accountability chart.`,

  rocks: `Help me identify our first quarterly Rocks. Interview me about:
1. What are the most important priorities for the next 90 days?
2. What's been stuck that we need to finally complete?
3. What will move our business forward the most?
4. Who should own each Rock?

Ask me questions to discover 3-7 Rocks, then help me make them SMART (Specific, Measurable, Attainable, Relevant, Time-bound).`,

  scorecard: `Let's build our Scorecard. Interview me to identify weekly metrics:
1. What numbers tell you if you had a good week?
2. What leading indicators predict future success?
3. What do you currently track (or wish you tracked)?
4. Who owns each metric?

Ask me questions to identify 5-15 measurable numbers we should track weekly, with targets.`,

  issuesList: `Let's capture our initial Issues List. Interview me about:
1. What's frustrating you about the business right now?
2. What obstacles keep coming up?
3. What opportunities are we not pursuing?
4. What problems do we keep avoiding?

Help me get everything out of our heads and onto the list. We'll prioritize later.`,

  l10Format: `Explain the Level 10 Meeting format and help me understand:
1. What's the agenda structure?
2. How long should each section take?
3. What makes an L10 effective?
4. What are common mistakes to avoid?`,
}

// VTO (Vision Building) coaching prompts - for Vision Building sessions
export const VTO_PROMPTS = {
  coreValues: `Let's discover our Core Values. Interview me to uncover what truly defines our culture:
1. Think of your best employees - what traits do they share?
2. When you're proud of how someone handled a situation, what did they do?
3. What behaviors are non-negotiable for your team?
4. What would you never tolerate, even from a high performer?

Ask me questions one at a time. We're looking for 3-7 core values that define who we are.`,

  coreFocus: `Let's define our Core Focus - our purpose and niche. Interview me about:
1. Why does our company exist beyond making money?
2. What are we passionate about?
3. What do we do better than anyone else?
4. What specific value do we provide to clients?

Help me articulate our Core Focus as: Purpose/Cause/Passion + Niche.`,

  tenYearTarget: `Let's set our 10-Year Target - a big, audacious goal. Interview me about:
1. Where do you see the company in 10 years?
2. What would make you incredibly proud?
3. What's a goal that seems almost impossible but exciting?
4. How will you measure success?

Help me craft a clear, measurable, inspirational 10-year target.`,

  marketingStrategy: `Let's define our Marketing Strategy. Interview me about:
1. Who is your ideal target market? Be specific.
2. What are your 3 Uniques - what differentiates you?
3. What's your Proven Process for delivering results?
4. What Guarantee can you offer?

Ask questions to help me articulate each element clearly.`,

  threeYearPicture: `Let's paint our 3-Year Picture. Interview me about where we'll be in 3 years:
1. What's our revenue target?
2. What does our profit look like?
3. How many people are on the team?
4. What does the org chart look like?
5. What are we known for in the market?

Help me create a vivid, measurable picture of success.`,

  oneYearPlan: `Let's build our 1-Year Plan. Interview me about the next 12 months:
1. What's our revenue goal?
2. What's our profit goal?
3. What are the 3-7 most important goals for this year?
4. What measurables define success?

Help me create clear, achievable annual goals.`,
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
