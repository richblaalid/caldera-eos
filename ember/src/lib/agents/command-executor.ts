import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getSlackClient, postThreadReply } from '@/lib/connectors/slack-connector'
import type { ParsedCommand, AgentOutputStatus } from '@/types/agents'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic()

interface ExecutionContext {
  partnerId: string
  organizationId: string
  channelId: string
  threadTs: string
  teamId: string
}

interface ReactionContext {
  partnerId: string
  organizationId: string
  channelId: string
  messageTs: string
  teamId: string
}

/**
 * Execute a parsed command and respond in Slack.
 */
export async function executeCommand(
  command: ParsedCommand,
  ctx: ExecutionContext
): Promise<void> {
  const client = await getSlackClient(ctx.organizationId)
  if (!client) return

  switch (command.command_type) {
    case 'approve':
      await handleApproveReject(command, ctx, 'approved', client)
      break
    case 'reject':
      await handleApproveReject(command, ctx, 'rejected', client)
      break
    case 'defer':
      await handleDefer(command, ctx, client)
      break
    case 'status_query':
      await handleStatusQuery(command, ctx, client)
      break
    case 'freeform':
      await handleFreeform(command, ctx, client)
      break
  }
}

/**
 * Handle approve/reject commands — update agent_outputs status.
 */
async function handleApproveReject(
  command: ParsedCommand,
  ctx: ExecutionContext,
  newStatus: 'approved' | 'rejected',
  client: Awaited<ReturnType<typeof getSlackClient>>
) {
  if (!client) return

  // Find today's briefing to map item numbers to output IDs
  const outputs = await resolveWorkQueueItems(ctx.partnerId, command.item_numbers)

  if (outputs.length === 0) {
    await postThreadReply(client, ctx.channelId, ctx.threadTs,
      `I couldn't find items ${command.item_numbers.join(', ')} in today's briefing.`)
    return
  }

  const updates: string[] = []
  for (const output of outputs) {
    await supabaseAdmin
      .from('agent_outputs')
      .update({
        status: newStatus as AgentOutputStatus,
        approved_by: ctx.partnerId,
        approved_at: new Date().toISOString(),
        ...(command.parameters.reason ? {
          execution_result: { rejection_reason: command.parameters.reason }
        } : {}),
      })
      .eq('id', output.output_id)

    const icon = newStatus === 'approved' ? ':white_check_mark:' : ':x:'
    updates.push(`${icon} *${output.title}* — ${newStatus}`)
  }

  await postThreadReply(client, ctx.channelId, ctx.threadTs, updates.join('\n'))
}

/**
 * Handle defer commands — update agent_outputs to deferred status.
 */
async function handleDefer(
  command: ParsedCommand,
  ctx: ExecutionContext,
  client: Awaited<ReturnType<typeof getSlackClient>>
) {
  if (!client) return

  const outputs = await resolveWorkQueueItems(ctx.partnerId, command.item_numbers)

  if (outputs.length === 0) {
    await postThreadReply(client, ctx.channelId, ctx.threadTs,
      `I couldn't find items ${command.item_numbers.join(', ')} in today's briefing.`)
    return
  }

  const deferTo = command.parameters.defer_to || 'next briefing'
  const updates: string[] = []

  for (const output of outputs) {
    await supabaseAdmin
      .from('agent_outputs')
      .update({
        status: 'deferred' as AgentOutputStatus,
        deferred_until: parseDeferDate(command.parameters.defer_to),
      })
      .eq('id', output.output_id)

    updates.push(`:pause_button: *${output.title}* — deferred to ${deferTo}`)
  }

  await postThreadReply(client, ctx.channelId, ctx.threadTs, updates.join('\n'))
}

/**
 * Handle status queries — invoke EA for a targeted response.
 */
async function handleStatusQuery(
  command: ParsedCommand,
  ctx: ExecutionContext,
  client: Awaited<ReturnType<typeof getSlackClient>>
) {
  if (!client) return

  const topic = command.parameters.topic || command.raw_text
  const answer = await askEA(topic, ctx)

  await postThreadReply(client, ctx.channelId, ctx.threadTs, answer)
}

/**
 * Handle freeform messages — route to EA as conversational agent.
 */
async function handleFreeform(
  command: ParsedCommand,
  ctx: ExecutionContext,
  client: Awaited<ReturnType<typeof getSlackClient>>
) {
  if (!client) return

  const question = command.parameters.question || command.raw_text
  const answer = await askEA(question, ctx)

  await postThreadReply(client, ctx.channelId, ctx.threadTs, answer)
}

/**
 * Resolve briefing work queue item numbers to their agent_output records.
 */
async function resolveWorkQueueItems(
  partnerId: string,
  itemNumbers: number[]
): Promise<{ output_id: string; title: string }[]> {
  const today = new Date().toISOString().split('T')[0]

  const { data: briefing } = await supabaseAdmin
    .from('briefings')
    .select('agent_work_queue')
    .eq('partner_id', partnerId)
    .eq('briefing_date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!briefing?.agent_work_queue) return []

  const workQueue = briefing.agent_work_queue as Array<{ id: string; output_id: string; title: string }>

  return workQueue
    .filter(item => itemNumbers.includes(parseInt(item.id, 10)))
    .map(item => ({ output_id: item.output_id, title: item.title }))
}

/**
 * Ask the EA agent a question and get a text response.
 */
async function askEA(question: string, ctx: ExecutionContext): Promise<string> {
  try {
    // Gather relevant context
    const [rocksData, todosData, metricsData] = await Promise.all([
      supabaseAdmin
        .from('rocks')
        .select('title, status, owner_id')
        .eq('organization_id', ctx.organizationId)
        .eq('status', 'on_track')
        .limit(10),
      supabaseAdmin
        .from('todos')
        .select('title, status, due_date')
        .eq('organization_id', ctx.organizationId)
        .eq('status', 'open')
        .limit(10),
      supabaseAdmin
        .from('scorecard_metrics')
        .select('title, goal, measurable_id:id')
        .eq('organization_id', ctx.organizationId)
        .limit(10),
    ])

    const context = [
      rocksData.data?.length ? `Active Rocks: ${JSON.stringify(rocksData.data)}` : '',
      todosData.data?.length ? `Open Todos: ${JSON.stringify(todosData.data)}` : '',
      metricsData.data?.length ? `Scorecard Metrics: ${JSON.stringify(metricsData.data)}` : '',
    ].filter(Boolean).join('\n\n')

    const response = await anthropic.messages.create({
      model: process.env.AGENT_DEFAULT_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are Ember, the AI Executive Assistant for Caldera's leadership team. You respond concisely and directly in Slack. Use Slack markdown formatting (bold with *, lists with •). Keep responses brief — 2-4 sentences for simple questions, up to a short paragraph for complex ones.

Current EOS data:
${context}`,
      messages: [{
        role: 'user',
        content: question,
      }],
    })

    return response.content[0].type === 'text'
      ? response.content[0].text
      : 'I encountered an issue processing your question. Please try again.'
  } catch (error) {
    console.error('EA query error:', error)
    return "Sorry, I'm having trouble processing that right now. Please try again in a moment."
  }
}

/**
 * Handle emoji reactions on briefing messages.
 * Maps reactions to commands: ✅ → approve, ⏸️ → defer, ❌ → reject
 */
export async function handleReaction(
  reaction: string,
  ctx: ReactionContext
): Promise<void> {
  // Map reactions to command types
  const reactionMap: Record<string, 'approve' | 'reject' | 'defer'> = {
    'white_check_mark': 'approve',
    'heavy_check_mark': 'approve',
    '+1': 'approve',
    'thumbsup': 'approve',
    'x': 'reject',
    'no_entry_sign': 'reject',
    'pause_button': 'defer',
    'clock3': 'defer',
  }

  const commandType = reactionMap[reaction]
  if (!commandType) return

  // Find the briefing that contains this message
  const { data: briefing } = await supabaseAdmin
    .from('briefings')
    .select('id, agent_work_queue, slack_message_ts')
    .eq('partner_id', ctx.partnerId)
    .eq('slack_channel_id', ctx.channelId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!briefing?.agent_work_queue || !briefing.slack_message_ts) return

  // For reactions on the main briefing message, we can't determine which item
  // was targeted — so we only process if there's exactly one pending work item
  const workQueue = briefing.agent_work_queue as Array<{
    id: string; output_id: string; title: string; status: string
  }>
  const pendingItems = workQueue.filter(item => item.status === 'pending_review')

  if (pendingItems.length === 1) {
    const command: ParsedCommand = {
      command_type: commandType,
      item_numbers: [parseInt(pendingItems[0].id, 10)],
      parameters: {},
      raw_text: `${reaction} reaction`,
    }

    await executeCommand(command, {
      partnerId: ctx.partnerId,
      organizationId: ctx.organizationId,
      channelId: ctx.channelId,
      threadTs: briefing.slack_message_ts,
      teamId: ctx.teamId,
    })
  } else if (pendingItems.length > 1) {
    // Multiple items — ask user to be specific
    const client = await getSlackClient(ctx.organizationId)
    if (client) {
      await postThreadReply(
        client,
        ctx.channelId,
        briefing.slack_message_ts,
        `I see ${pendingItems.length} pending items. Please reply with a specific command like "approve 3" or "reject 2 — reason".`
      )
    }
  }
}

/**
 * Parse a natural language defer date into an ISO date string.
 */
function parseDeferDate(deferTo?: string): string | null {
  if (!deferTo) return null

  const lower = deferTo.toLowerCase()
  const today = new Date()

  const dayMap: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  }

  const targetDay = dayMap[lower]
  if (targetDay !== undefined) {
    const currentDay = today.getDay()
    let daysAhead = targetDay - currentDay
    if (daysAhead <= 0) daysAhead += 7
    const target = new Date(today)
    target.setDate(today.getDate() + daysAhead)
    return target.toISOString().split('T')[0]
  }

  if (lower === 'tomorrow') {
    const target = new Date(today)
    target.setDate(today.getDate() + 1)
    return target.toISOString().split('T')[0]
  }

  if (lower === 'next week') {
    const target = new Date(today)
    target.setDate(today.getDate() + 7)
    return target.toISOString().split('T')[0]
  }

  return null
}
