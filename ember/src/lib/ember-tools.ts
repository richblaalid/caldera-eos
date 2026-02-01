/**
 * Ember Tools - Tool definitions for Claude to save EOS data
 * These tools allow Ember to save structured data from conversations
 */

import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { createClient } from '@/lib/supabase/server'
import type {
  VTO,
  AccountabilityRole,
  RockInsert,
  IssueInsert,
  ScorecardMetricInsert,
} from '@/types/database'

// =============================================
// Tool Definitions for Claude API
// =============================================

export const EMBER_TOOLS: Tool[] = [
  {
    name: 'save_accountability_chart',
    description:
      'Save the accountability chart (organization structure with roles and owners) to the V/TO. Use this after gathering and confirming accountability chart information with the user. Always confirm with the user before saving.',
    input_schema: {
      type: 'object' as const,
      properties: {
        roles: {
          type: 'array',
          description: 'Array of accountability chart roles',
          items: {
            type: 'object',
            properties: {
              seat: {
                type: 'string',
                enum: ['visionary', 'integrator', 'sales', 'operations', 'finance', 'other'],
                description: 'The seat/function type',
              },
              title: {
                type: 'string',
                description: 'The role title (e.g., "Head of Sales", "Integrator")',
              },
              person_name: {
                type: 'string',
                description: 'Name of the person in this seat',
              },
              responsibilities: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of key responsibilities for this role',
              },
            },
            required: ['seat', 'title', 'person_name'],
          },
        },
      },
      required: ['roles'],
    },
  },
  {
    name: 'save_core_values',
    description:
      'Save the core values to the V/TO. Use this after discovering and confirming core values with the user. Core values define the culture - typically 3-7 values.',
    input_schema: {
      type: 'object' as const,
      properties: {
        core_values: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of core values (3-7 values that define the culture)',
        },
      },
      required: ['core_values'],
    },
  },
  {
    name: 'save_core_focus',
    description:
      'Save the core focus (purpose and niche) to the V/TO. Use this after defining and confirming the core focus with the user.',
    input_schema: {
      type: 'object' as const,
      properties: {
        purpose: {
          type: 'string',
          description: 'The purpose/cause/passion - why the company exists',
        },
        niche: {
          type: 'string',
          description: 'The niche - what the company does best, their specialty',
        },
      },
      required: ['purpose', 'niche'],
    },
  },
  {
    name: 'save_ten_year_target',
    description:
      'Save the 10-year target (BHAG - Big Hairy Audacious Goal) to the V/TO. This should be a big, measurable, inspiring goal.',
    input_schema: {
      type: 'object' as const,
      properties: {
        goal: {
          type: 'string',
          description: 'The 10-year target goal statement',
        },
        target_date: {
          type: 'string',
          description: 'Target date for achieving this goal (e.g., "2035")',
        },
      },
      required: ['goal'],
    },
  },
  {
    name: 'save_three_year_picture',
    description:
      'Save the 3-year picture to the V/TO. This is a vivid, measurable description of where the company will be in 3 years.',
    input_schema: {
      type: 'object' as const,
      properties: {
        target_date: {
          type: 'string',
          description: 'Target date (e.g., "December 2028")',
        },
        revenue: {
          type: 'string',
          description: 'Revenue target (e.g., "$10M")',
        },
        profit: {
          type: 'string',
          description: 'Profit target or description',
        },
        team_size: {
          type: 'number',
          description: 'Target team size',
        },
        measurables: {
          type: 'array',
          items: { type: 'string' },
          description: 'Key measurables for the 3-year picture',
        },
        what_does_it_look_like: {
          type: 'array',
          items: { type: 'string' },
          description: 'Bullet points describing what success looks like',
        },
      },
      required: ['target_date', 'measurables'],
    },
  },
  {
    name: 'save_one_year_plan',
    description:
      'Save the 1-year plan to the V/TO. This includes annual goals and measurables.',
    input_schema: {
      type: 'object' as const,
      properties: {
        target_date: {
          type: 'string',
          description: 'Target date (e.g., "December 2026")',
        },
        revenue: {
          type: 'string',
          description: 'Revenue goal',
        },
        profit: {
          type: 'string',
          description: 'Profit goal',
        },
        measurables: {
          type: 'array',
          items: { type: 'string' },
          description: 'Key measurables for the year',
        },
        goals: {
          type: 'array',
          items: { type: 'string' },
          description: 'The 3-7 most important goals for the year',
        },
      },
      required: ['target_date', 'goals'],
    },
  },
  {
    name: 'save_quarterly_rocks',
    description:
      'Save quarterly rocks (90-day priorities) to the system. Creates rocks in the database with owners.',
    input_schema: {
      type: 'object' as const,
      properties: {
        quarter: {
          type: 'string',
          description: 'The quarter (e.g., "Q1 2026")',
        },
        rocks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Rock title - clear and specific',
              },
              description: {
                type: 'string',
                description: 'Detailed description of what success looks like',
              },
              owner_name: {
                type: 'string',
                description: 'Name of the rock owner (Rich, John, or Wade)',
              },
              due_date: {
                type: 'string',
                description: 'Due date in YYYY-MM-DD format',
              },
            },
            required: ['title', 'owner_name'],
          },
        },
      },
      required: ['quarter', 'rocks'],
    },
  },
  {
    name: 'save_scorecard_metrics',
    description:
      'Save scorecard metrics (weekly measurable numbers) to the system. These are the 5-15 numbers tracked weekly.',
    input_schema: {
      type: 'object' as const,
      properties: {
        metrics: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Metric name',
              },
              description: {
                type: 'string',
                description: 'What this metric measures',
              },
              target: {
                type: 'number',
                description: 'Target value for this metric',
              },
              unit: {
                type: 'string',
                description: 'Unit of measurement (e.g., "$", "%", "calls")',
              },
              goal_direction: {
                type: 'string',
                enum: ['above', 'below', 'equal'],
                description: 'Whether goal is to be above, below, or equal to target',
              },
              owner_name: {
                type: 'string',
                description: 'Name of the metric owner',
              },
            },
            required: ['name', 'target', 'goal_direction', 'owner_name'],
          },
        },
      },
      required: ['metrics'],
    },
  },
  {
    name: 'save_issues',
    description:
      'Save issues to the issues list. These are obstacles, problems, or opportunities to address.',
    input_schema: {
      type: 'object' as const,
      properties: {
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Issue title - clear statement of the problem',
              },
              description: {
                type: 'string',
                description: 'More detail about the issue',
              },
              priority: {
                type: 'number',
                description: 'Priority 1-3 (1 = highest priority)',
              },
              owner_name: {
                type: 'string',
                description: 'Name of the issue owner (optional)',
              },
            },
            required: ['title'],
          },
        },
      },
      required: ['issues'],
    },
  },
]

// =============================================
// Tool Execution Handlers
// =============================================

export interface ToolResult {
  success: boolean
  message: string
  data?: unknown
}

/**
 * Execute a tool call and return the result
 */
export async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<ToolResult> {
  const supabase = await createClient()

  try {
    switch (toolName) {
      case 'save_accountability_chart':
        return await saveAccountabilityChart(supabase, toolInput)
      case 'save_core_values':
        return await saveCoreValues(supabase, toolInput)
      case 'save_core_focus':
        return await saveCoreFocus(supabase, toolInput)
      case 'save_ten_year_target':
        return await saveTenYearTarget(supabase, toolInput)
      case 'save_three_year_picture':
        return await saveThreeYearPicture(supabase, toolInput)
      case 'save_one_year_plan':
        return await saveOneYearPlan(supabase, toolInput)
      case 'save_quarterly_rocks':
        return await saveQuarterlyRocks(supabase, toolInput)
      case 'save_scorecard_metrics':
        return await saveScorecardMetrics(supabase, toolInput)
      case 'save_issues':
        return await saveIssues(supabase, toolInput)
      default:
        return { success: false, message: `Unknown tool: ${toolName}` }
    }
  } catch (error) {
    console.error(`Tool execution error for ${toolName}:`, error)
    return {
      success: false,
      message: `Error executing ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

// Helper to get or create V/TO
async function getOrCreateVTO(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never): Promise<VTO> {
  const { data: existing } = await supabase
    .from('vto')
    .select('*')
    .order('version', { ascending: false })
    .limit(1)
    .single()

  if (existing) return existing as VTO

  // Create new V/TO
  const { data: created, error } = await supabase
    .from('vto')
    .insert({
      core_values: [],
      core_focus: { purpose: '', niche: '' },
      ten_year_target: { goal: '', target_date: '' },
      marketing_strategy: { target_market: {}, three_uniques: [] },
      three_year_picture: { target_date: '', measurables: [], what_does_it_look_like: [] },
      one_year_plan: { target_date: '', measurables: [], goals: [] },
      quarterly_rocks: [],
      issues_list: [],
      accountability_chart: [],
      version: 1,
    })
    .select()
    .single()

  if (error) throw error
  return created as VTO
}

// Helper to get profile by name
async function getProfileByName(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  name: string
): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, name')
    .ilike('name', `%${name}%`)
    .limit(1)
    .single()

  return data?.id || null
}

// Tool handlers
async function saveAccountabilityChart(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const roles = input.roles as Array<{
    seat: string
    title: string
    person_name: string
    responsibilities?: string[]
  }>

  const vto = await getOrCreateVTO(supabase)

  const accountabilityChart: AccountabilityRole[] = roles.map((role) => ({
    seat: role.seat as AccountabilityRole['seat'],
    title: role.title,
    owner_name: role.person_name,
    lma: role.responsibilities || [],
  }))

  const { error } = await supabase
    .from('vto')
    .update({
      accountability_chart: accountabilityChart,
      version: vto.version + 1,
    })
    .eq('id', vto.id)

  if (error) throw error

  return {
    success: true,
    message: `Saved ${roles.length} roles to the Accountability Chart.`,
    data: accountabilityChart,
  }
}

async function saveCoreValues(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const coreValues = input.core_values as string[]
  const vto = await getOrCreateVTO(supabase)

  const { error } = await supabase
    .from('vto')
    .update({
      core_values: coreValues,
      version: vto.version + 1,
    })
    .eq('id', vto.id)

  if (error) throw error

  return {
    success: true,
    message: `Saved ${coreValues.length} core values: ${coreValues.join(', ')}`,
    data: coreValues,
  }
}

async function saveCoreFocus(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const purpose = input.purpose as string
  const niche = input.niche as string
  const vto = await getOrCreateVTO(supabase)

  const { error } = await supabase
    .from('vto')
    .update({
      core_focus: { purpose, niche },
      version: vto.version + 1,
    })
    .eq('id', vto.id)

  if (error) throw error

  return {
    success: true,
    message: `Saved Core Focus - Purpose: "${purpose}" | Niche: "${niche}"`,
    data: { purpose, niche },
  }
}

async function saveTenYearTarget(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const goal = input.goal as string
  const targetDate = (input.target_date as string) || ''
  const vto = await getOrCreateVTO(supabase)

  const { error } = await supabase
    .from('vto')
    .update({
      ten_year_target: { goal, target_date: targetDate },
      version: vto.version + 1,
    })
    .eq('id', vto.id)

  if (error) throw error

  return {
    success: true,
    message: `Saved 10-Year Target: "${goal}"`,
    data: { goal, target_date: targetDate },
  }
}

async function saveThreeYearPicture(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const vto = await getOrCreateVTO(supabase)

  const threeYearPicture = {
    target_date: input.target_date as string,
    revenue: input.revenue as string | undefined,
    profit: input.profit as string | undefined,
    team_size: input.team_size as number | undefined,
    measurables: input.measurables as string[],
    what_does_it_look_like: (input.what_does_it_look_like as string[]) || [],
  }

  const { error } = await supabase
    .from('vto')
    .update({
      three_year_picture: threeYearPicture,
      version: vto.version + 1,
    })
    .eq('id', vto.id)

  if (error) throw error

  return {
    success: true,
    message: `Saved 3-Year Picture for ${threeYearPicture.target_date}`,
    data: threeYearPicture,
  }
}

async function saveOneYearPlan(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const vto = await getOrCreateVTO(supabase)
  const goals = input.goals as string[]

  const oneYearPlan = {
    target_date: input.target_date as string,
    revenue: input.revenue as string | undefined,
    profit: input.profit as string | undefined,
    measurables: (input.measurables as string[]) || [],
    goals: goals.map((description, index) => ({
      id: crypto.randomUUID(),
      description,
      completed: false,
      order: index,
    })),
  }

  const { error } = await supabase
    .from('vto')
    .update({
      one_year_plan: oneYearPlan,
      version: vto.version + 1,
    })
    .eq('id', vto.id)

  if (error) throw error

  return {
    success: true,
    message: `Saved 1-Year Plan with ${goals.length} goals for ${oneYearPlan.target_date}`,
    data: oneYearPlan,
  }
}

async function saveQuarterlyRocks(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const quarter = input.quarter as string
  const rocks = input.rocks as Array<{
    title: string
    description?: string
    owner_name: string
    due_date?: string
  }>

  const createdRocks: RockInsert[] = []

  for (const rock of rocks) {
    const ownerId = await getProfileByName(supabase, rock.owner_name)

    const rockInsert: RockInsert = {
      title: rock.title,
      description: rock.description || null,
      quarter,
      owner_id: ownerId,
      status: 'on_track',
      due_date: rock.due_date || null,
      milestones: [],
    }

    const { data, error } = await supabase.from('rocks').insert(rockInsert).select().single()

    if (error) {
      console.error('Error creating rock:', error)
    } else {
      createdRocks.push(data)
    }
  }

  return {
    success: true,
    message: `Created ${createdRocks.length} rocks for ${quarter}`,
    data: createdRocks,
  }
}

async function saveScorecardMetrics(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const metrics = input.metrics as Array<{
    name: string
    description?: string
    target: number
    unit?: string
    goal_direction: 'above' | 'below' | 'equal'
    owner_name: string
  }>

  const createdMetrics: ScorecardMetricInsert[] = []

  // Get current max display order
  const { data: existing } = await supabase
    .from('scorecard_metrics')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)

  let displayOrder = (existing?.[0]?.display_order ?? 0) + 1

  for (const metric of metrics) {
    const ownerId = await getProfileByName(supabase, metric.owner_name)

    const metricInsert: ScorecardMetricInsert = {
      name: metric.name,
      description: metric.description || null,
      target: metric.target,
      unit: metric.unit || null,
      goal_direction: metric.goal_direction,
      owner_id: ownerId,
      display_order: displayOrder++,
      is_active: true,
    }

    const { data, error } = await supabase
      .from('scorecard_metrics')
      .insert(metricInsert)
      .select()
      .single()

    if (error) {
      console.error('Error creating metric:', error)
    } else {
      createdMetrics.push(data)
    }
  }

  return {
    success: true,
    message: `Created ${createdMetrics.length} scorecard metrics`,
    data: createdMetrics,
  }
}

async function saveIssues(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const issues = input.issues as Array<{
    title: string
    description?: string
    priority?: number
    owner_name?: string
  }>

  const createdIssues: IssueInsert[] = []

  for (const issue of issues) {
    const ownerId = issue.owner_name ? await getProfileByName(supabase, issue.owner_name) : null

    const issueInsert: IssueInsert = {
      title: issue.title,
      description: issue.description || null,
      priority: issue.priority || 2,
      status: 'open',
      source: 'manual',
      owner_id: ownerId,
    }

    const { data, error } = await supabase.from('issues').insert(issueInsert).select().single()

    if (error) {
      console.error('Error creating issue:', error)
    } else {
      createdIssues.push(data)
    }
  }

  return {
    success: true,
    message: `Created ${createdIssues.length} issues`,
    data: createdIssues,
  }
}
