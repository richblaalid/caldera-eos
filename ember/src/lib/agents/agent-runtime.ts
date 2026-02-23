import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { buildSystemPrompt, type AgentContext } from './prompt-manager'
import type {
  AgentDefinition,
  AgentInvocation,
  AgentResult,
  AgentOutputInsert,
  AgentRunInsert,
  AgentRunError,
  SlackNotification,
  EOSAction,
} from '@/types/agents'

const anthropic = new Anthropic()

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Invoke an agent: load definition, assemble context, call Claude,
 * process output, log the run.
 */
export async function invokeAgent(
  invocation: AgentInvocation,
  context: AgentContext,
  options: {
    model?: string
    maxTokens?: number
    userPrompt: string
  }
): Promise<AgentResult> {
  const runId = crypto.randomUUID()
  const startedAt = new Date()

  // 1. Load agent definition
  const agentDef = await loadAgentDefinition(invocation.agentId)
  if (!agentDef) {
    return {
      outputs: [],
      notifications: [],
      eosActions: [],
      errors: [{ message: `Agent '${invocation.agentId}' not found` }],
      tokenUsage: { input: 0, output: 0 },
    }
  }

  // 2. Log run start
  const orgId = agentDef.organization_id
  await logRunStart({
    id: runId,
    organization_id: orgId,
    agent_id: invocation.agentId,
    trigger_type: invocation.trigger,
    trigger_context: invocation.triggerContext,
    model: options.model,
  })

  try {
    // 3. Build system prompt
    const systemPrompt = buildSystemPrompt(agentDef, context)

    // 4. Call Claude
    const model = options.model || process.env.AGENT_DEFAULT_MODEL || 'claude-sonnet-4-20250514'
    const response = await anthropic.messages.create({
      model,
      max_tokens: options.maxTokens || 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: options.userPrompt }],
    })

    const textContent = response.content.find(c => c.type === 'text')
    const text = textContent?.type === 'text' ? textContent.text : ''

    // 5. Log run completion
    const duration = Date.now() - startedAt.getTime()
    await logRunComplete(runId, {
      duration_ms: duration,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      model,
      status: 'completed',
    })

    return {
      outputs: [],
      notifications: [],
      eosActions: [],
      errors: [],
      tokenUsage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
      // Attach raw text for callers to parse
      _rawText: text,
    } as AgentResult & { _rawText: string }
  } catch (error: unknown) {
    const err = error as { message?: string }
    const duration = Date.now() - startedAt.getTime()

    await logRunComplete(runId, {
      duration_ms: duration,
      status: 'failed',
      errors: [{ message: err.message || 'Unknown error', timestamp: new Date().toISOString() }],
    })

    return {
      outputs: [],
      notifications: [],
      eosActions: [],
      errors: [{ message: err.message || 'Agent invocation failed' }],
      tokenUsage: { input: 0, output: 0 },
    }
  }
}

/**
 * Store an agent output in the database.
 */
export async function saveAgentOutput(output: AgentOutputInsert): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('agent_outputs')
    .insert(output)
    .select('id')
    .single()

  if (error) {
    console.error('Failed to save agent output:', error)
    return null
  }

  return data.id
}

/**
 * Load an agent definition from the database.
 */
async function loadAgentDefinition(agentId: string): Promise<AgentDefinition | null> {
  const { data, error } = await supabaseAdmin
    .from('agent_definitions')
    .select('*')
    .eq('id', agentId)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    console.error(`Failed to load agent '${agentId}':`, error)
    return null
  }

  return data as AgentDefinition
}

async function logRunStart(run: AgentRunInsert): Promise<void> {
  const { error } = await supabaseAdmin.from('agent_runs').insert(run)
  if (error) console.error('Failed to log run start:', error)
}

async function logRunComplete(
  runId: string,
  update: {
    duration_ms: number
    input_tokens?: number
    output_tokens?: number
    model?: string
    status: 'completed' | 'failed'
    errors?: AgentRunError[]
    outputs_created?: number
  }
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('agent_runs')
    .update({
      completed_at: new Date().toISOString(),
      ...update,
    })
    .eq('id', runId)

  if (error) console.error('Failed to log run complete:', error)
}

// Re-export for convenience
export type { AgentContext, AgentResult, AgentOutputInsert, SlackNotification, EOSAction }
