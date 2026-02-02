/**
 * Ember - AI EOS Integrator
 * Core prompts and configuration for the Ember AI coaching system
 */

import type { VTO } from '@/types/database'

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

// Caldera business context for informed coaching
export const CALDERA_BUSINESS_CONTEXT = {
  company: {
    name: 'Caldera',
    description: 'AI-focused product development and consulting firm',
    tagline: 'Cutting through red tape to deliver enterprise results faster',
  },
  services: [
    {
      name: 'Design & Product Strategy',
      description: 'Visionary designs and rapid design/testing processes',
    },
    {
      name: 'Scalable Development',
      description: 'Custom software development with AI acceleration',
    },
    {
      name: 'AI Solutions',
      description: 'Pragmatic AI implementations in business products',
    },
  ],
  targetMarket: 'Enterprise and mid-market organizations seeking digital transformation',
  notableClients: ["Church's Texas Chicken", 'Verizon', 'Hy-Vee', 'SCHEELS', 'RedBoxRx'],
  industries: ['Retail', 'Healthcare', 'Telecommunications', 'Loyalty/Commerce'],
  revenueModel: 'Mix of ongoing retainers and project-based engagements',
  differentiators: [
    'AI-enabled teams delivering enterprise results faster and cheaper',
    'Small expert teams that move like your own, just faster',
    'Build internal AI capabilities while clients learn',
    '10+ years of collaborative engineering history, 3+ years specializing in AI',
  ],
  technologyFocus: [
    'On-device/edge AI and Apple Intelligence',
    'Agentic AI systems',
    'Mobile and cross-platform development (iOS, macOS, visionOS)',
    'Large language models and computer vision',
  ],
  currentChallenge: 'Building a stronger sales pipeline to drive growth',
}

// =============================================
// EOS Journey Stages
// =============================================

export type EOSJourneyStage =
  | 'pre_focus_day'      // No V/TO data - need to start with Focus Day
  | 'focus_day'          // V/TO partially complete (rocks, scorecard, issues)
  | 'vision_building'    // Focus Day done, need to complete Core Values, Core Focus, etc.
  | 'vto_complete'       // V/TO is complete, ready for ongoing implementation
  | 'ongoing'            // Running EOS - L10s, quarterly sessions

/**
 * Determine where Caldera is in their EOS journey based on V/TO state
 */
export function determineJourneyStage(vto: VTO | null): EOSJourneyStage {
  if (!vto) {
    return 'pre_focus_day'
  }

  // Check Focus Day outputs (Rocks, Scorecard, Issues, Accountability Chart)
  const hasFocusDayOutputs =
    (vto.quarterly_rocks && vto.quarterly_rocks.length > 0) ||
    (vto.issues_list && vto.issues_list.length > 0) ||
    (vto.accountability_chart && vto.accountability_chart.length > 0)

  // Check Vision elements
  const hasCoreValues = vto.core_values && vto.core_values.length > 0
  const hasCoreFocus = vto.core_focus?.purpose && vto.core_focus?.niche
  const hasTenYearTarget = vto.ten_year_target?.goal
  const hasThreeYearPicture = vto.three_year_picture?.measurables && vto.three_year_picture.measurables.length > 0
  const hasOneYearPlan = vto.one_year_plan?.goals && vto.one_year_plan.goals.length > 0

  // Full Vision check
  const hasVision = hasCoreValues && hasCoreFocus && hasTenYearTarget && hasThreeYearPicture && hasOneYearPlan

  if (!hasFocusDayOutputs) {
    return 'pre_focus_day'
  }

  if (!hasCoreValues || !hasCoreFocus || !hasTenYearTarget) {
    return 'focus_day'
  }

  if (!hasVision) {
    return 'vision_building'
  }

  // Check if they have established patterns (meetings, ongoing data)
  // For now, if V/TO is complete, they're in ongoing mode
  return 'ongoing'
}

/**
 * Get the priority focus and suggested actions for the current stage
 */
export function getJourneyStageFocus(stage: EOSJourneyStage): {
  priority: string
  description: string
  suggestedActions: string[]
} {
  switch (stage) {
    case 'pre_focus_day':
      return {
        priority: 'Focus Day Preparation',
        description: 'Caldera has not yet completed their Focus Day - the foundational EOS session. This is where we establish the basics: Accountability Chart, initial Rocks, Scorecard, and Issues List.',
        suggestedActions: [
          'Start with Accountability Chart - identify major functions and who owns them',
          'Discover initial Quarterly Rocks (3-7 priorities for the next 90 days)',
          'Build the Scorecard with 5-15 weekly measurable numbers',
          'Create the initial Issues List - get everything out of their heads',
        ],
      }
    case 'focus_day':
      return {
        priority: 'Complete Focus Day',
        description: 'Focus Day has started but is not complete. Continue working through the Focus Day elements.',
        suggestedActions: [
          'Complete any remaining Focus Day outputs (Rocks, Scorecard, Issues, Accountability Chart)',
          'Review and refine what has been captured so far',
          'Prepare to move into Vision Building',
        ],
      }
    case 'vision_building':
      return {
        priority: 'Vision Building',
        description: 'Focus Day is complete. Now we need to build the vision: Core Values, Core Focus, 10-Year Target, Marketing Strategy, 3-Year Picture, and 1-Year Plan.',
        suggestedActions: [
          'Discover Core Values (3-7 values that define who you are)',
          'Define Core Focus (Purpose + Niche)',
          'Set the 10-Year Target (big, audacious, measurable goal)',
          'Build Marketing Strategy (Target Market, 3 Uniques, Proven Process)',
          'Paint the 3-Year Picture (vivid, measurable future state)',
          'Create the 1-Year Plan (annual goals and measurables)',
        ],
      }
    case 'vto_complete':
      return {
        priority: 'Implementation',
        description: 'V/TO is complete! Time to implement the Level 10 Meeting cadence and run EOS.',
        suggestedActions: [
          'Schedule and run weekly L10 meetings',
          'Track Rock progress',
          'Update Scorecard weekly',
          'Work through Issues using IDS',
        ],
      }
    case 'ongoing':
      return {
        priority: 'Continuous Improvement',
        description: 'EOS is running. Focus on accountability, quarterly Rock reviews, annual planning, and continuous improvement.',
        suggestedActions: [
          'Prepare for L10 meetings',
          'Review Rock progress and update statuses',
          'Analyze Scorecard trends',
          'Prioritize and solve Issues',
          'Hold quarterly Rock reviews',
          'Conduct annual planning sessions',
        ],
      }
  }
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

## Caldera Business Context
Caldera is an AI-focused product development and consulting firm that helps enterprise and mid-market organizations with digital transformation. The company delivers three core services:
1. **Design & Product Strategy** - Visionary designs and rapid design/testing processes
2. **Scalable Development** - Custom software development with AI acceleration
3. **AI Solutions** - Pragmatic AI implementations in business products

**Revenue Model:** Mix of ongoing retainers and project-based engagements (billable hours)

**Target Market:** Enterprise and mid-market organizations in retail, healthcare, telecommunications, and loyalty/commerce sectors

**Key Differentiators:**
- AI-enabled teams delivering enterprise results faster and more cost-effectively
- Small expert teams that integrate seamlessly with client teams
- Build internal AI capabilities while clients learn alongside
- 10+ years of collaborative engineering history, 3+ years specializing in AI

**Technology Focus:** On-device/edge AI, agentic AI systems, Apple platforms (iOS, macOS, visionOS), LLMs, and computer vision

**Notable Clients:** Church's Texas Chicken, Verizon, Hy-Vee, SCHEELS, RedBoxRx

**Current Strategic Challenge:** Building a stronger sales pipeline to drive growth

## Leadership Team
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

// =============================================
// Dynamic System Prompt Builder
// =============================================

/**
 * Build a dynamic system prompt based on the EOS journey stage
 */
export function buildDynamicSystemPrompt(
  stage: EOSJourneyStage,
  vtoSummary?: string
): string {
  const stageFocus = getJourneyStageFocus(stage)

  // Base prompt is always included
  let prompt = EMBER_CHAT_SYSTEM_PROMPT

  // Add journey-specific context
  prompt += `\n\n## Current EOS Journey Status

**Stage: ${stageFocus.priority}**
${stageFocus.description}

**Your Primary Focus:**
${stageFocus.suggestedActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

`

  // Add stage-specific behavioral guidance
  switch (stage) {
    case 'pre_focus_day':
      prompt += `## IMPORTANT: Focus Day Mode

Caldera has not yet had their Focus Day. This is the FIRST step in their EOS journey.

**Your behavior in this mode:**
1. When they greet you or ask what to do, immediately orient them toward Focus Day
2. Explain what Focus Day accomplishes and why it matters
3. Offer to facilitate the Focus Day session through conversation
4. Use INTERVIEW MODE: Ask ONE question at a time, wait for response, dig deeper
5. Don't overwhelm with multiple questions - be conversational and patient
6. After gathering information on a topic, summarize and confirm before moving on

**Focus Day Session Flow:**
1. **Accountability Chart** - Map out major functions and seats
2. **Rocks** - Identify 3-7 quarterly priorities
3. **Scorecard** - Define 5-15 weekly numbers to track
4. **Issues List** - Get everything out of their heads

**Opening Suggestion:**
When they start the conversation, greet them warmly and explain that since they haven't completed Focus Day yet, this is where you recommend starting. Offer to guide them through it conversationally.

Example opening:
"Welcome to Ember! I see you're starting your EOS journey - exciting! The first step is Focus Day, where we'll establish your foundation: who does what (Accountability Chart), your top priorities for the next 90 days (Rocks), the numbers you'll track weekly (Scorecard), and everything that's on your mind (Issues List). Would you like to start with the Accountability Chart? I'll guide you through it one question at a time."
`
      break

    case 'focus_day':
      prompt += `## Focus Day Continuation Mode

Caldera has started Focus Day but hasn't completed all elements. Help them finish.

**Your behavior:**
1. Check what's been completed and what's missing
2. Offer to continue where they left off
3. Maintain interview mode - one question at a time
4. Summarize progress and celebrate wins
`
      break

    case 'vision_building':
      prompt += `## Vision Building Mode

Focus Day is done! Now guide Caldera through creating their vision.

**Your behavior:**
1. Congratulate them on completing Focus Day
2. Explain the Vision Building process
3. Guide them through Core Values, Core Focus, 10-Year Target, etc.
4. Use interview mode for each section
5. Help them think BIG for long-term targets

**Vision Building Flow:**
1. Core Values (start here - defines culture)
2. Core Focus (Purpose + Niche)
3. 10-Year Target (BHAG)
4. Marketing Strategy
5. 3-Year Picture
6. 1-Year Plan
`
      break

    case 'vto_complete':
    case 'ongoing':
      prompt += `## Ongoing Implementation Mode

The V/TO is complete. Focus on execution and accountability.

**Your behavior:**
1. Help prepare for and debrief L10 meetings
2. Review Rock progress and call out any that are off-track
3. Analyze Scorecard trends and highlight concerns
4. Facilitate IDS for Issues
5. Hold the team accountable to their commitments
6. Celebrate wins and progress
`
      break
  }

  // Add V/TO summary if available
  if (vtoSummary) {
    prompt += `\n\n## Current V/TO Summary\n${vtoSummary}`
  }

  return prompt
}

/**
 * Format V/TO data into a summary for context
 */
export function formatVTOSummary(vto: VTO | null): string {
  if (!vto) return 'No V/TO data yet.'

  const sections: string[] = []

  if (vto.core_values && vto.core_values.length > 0) {
    sections.push(`**Core Values:** ${vto.core_values.join(', ')}`)
  }

  if (vto.core_focus?.purpose || vto.core_focus?.niche) {
    sections.push(`**Core Focus:** Purpose: "${vto.core_focus.purpose || 'Not defined'}" | Niche: "${vto.core_focus.niche || 'Not defined'}"`)
  }

  if (vto.ten_year_target?.goal) {
    sections.push(`**10-Year Target:** ${vto.ten_year_target.goal}`)
  }

  if (vto.three_year_picture?.measurables && vto.three_year_picture.measurables.length > 0) {
    sections.push(`**3-Year Picture:** ${vto.three_year_picture.measurables.slice(0, 3).join(', ')}${vto.three_year_picture.measurables.length > 3 ? '...' : ''}`)
  }

  if (vto.one_year_plan?.goals && vto.one_year_plan.goals.length > 0) {
    sections.push(`**1-Year Goals:** ${vto.one_year_plan.goals.slice(0, 3).map(g => g.description).join(', ')}${vto.one_year_plan.goals.length > 3 ? '...' : ''}`)
  }

  if (vto.quarterly_rocks && vto.quarterly_rocks.length > 0) {
    sections.push(`**Quarterly Rocks:** ${vto.quarterly_rocks.length} defined`)
  }

  if (vto.issues_list && vto.issues_list.length > 0) {
    sections.push(`**Issues List:** ${vto.issues_list.length} issues`)
  }

  if (vto.accountability_chart && vto.accountability_chart.length > 0) {
    sections.push(`**Accountability Chart:** ${vto.accountability_chart.length} roles defined`)
  }

  return sections.length > 0 ? sections.join('\n') : 'V/TO exists but is empty.'
}

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
