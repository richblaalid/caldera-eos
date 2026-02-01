import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/claude'
import { buildDynamicSystemPrompt } from '@/lib/ember'
import { retrieveContext, buildChatContext } from '@/lib/context'
import { EMBER_TOOLS, executeToolCall } from '@/lib/ember-tools'
import type { ChatMessageInsert, ChatMessageMetadata } from '@/types/database'
import type { MessageParam, ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'

export const runtime = 'nodejs'
export const maxDuration = 60

interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  conversationId?: string
}

// POST /api/chat - Send a message and stream response
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body: ChatRequest = await request.json()
    const { messages, conversationId } = body

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get or create conversation ID
    const currentConversationId = conversationId || crypto.randomUUID()

    // Save the user message
    const lastUserMessage = messages[messages.length - 1]
    if (lastUserMessage.role === 'user') {
      const userMessage: ChatMessageInsert = {
        user_id: user.id,
        conversation_id: currentConversationId,
        role: 'user',
        content: lastUserMessage.content,
        metadata: {},
      }
      await supabase.from('chat_messages').insert(userMessage)
    }

    // Retrieve context for the query (includes V/TO and journey stage)
    const context = await retrieveContext(lastUserMessage.content)
    const contextString = buildChatContext(context)

    // Build dynamic system prompt based on journey stage
    const basePrompt = buildDynamicSystemPrompt(context.journeyStage, context.vtoSummary)
    const systemPrompt = basePrompt + contextString + TOOL_USE_INSTRUCTIONS

    // Track sources for metadata
    const sources = context.sources

    // Create a TransformStream to handle the streaming
    const encoder = new TextEncoder()
    let fullResponse = ''
    const toolResults: Array<{ tool: string; result: string }> = []

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Convert messages for Claude API
          const apiMessages: MessageParam[] = messages.map((m) => ({
            role: m.role,
            content: m.content,
          }))

          // Initial Claude call with tools
          let continueLoop = true
          let currentMessages = apiMessages

          while (continueLoop) {
            const response = await anthropic.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 4096,
              system: systemPrompt,
              tools: EMBER_TOOLS,
              messages: currentMessages,
            })

            // Process the response content blocks
            for (const block of response.content) {
              if (block.type === 'text') {
                fullResponse += block.text
                // Stream the text to the client
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: block.text })}\n\n`)
                )
              } else if (block.type === 'tool_use') {
                // Execute the tool
                const toolResult = await executeToolCall(
                  block.name,
                  block.input as Record<string, unknown>
                )

                toolResults.push({
                  tool: block.name,
                  result: toolResult.message,
                })

                // Notify client about the tool execution
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      tool_execution: {
                        tool: block.name,
                        success: toolResult.success,
                        message: toolResult.message,
                      },
                    })}\n\n`
                  )
                )

                // Add assistant message and tool result to continue the conversation
                const assistantContent: ContentBlockParam[] = response.content.map((c) => {
                  if (c.type === 'text') {
                    return { type: 'text' as const, text: c.text }
                  } else if (c.type === 'tool_use') {
                    return {
                      type: 'tool_use' as const,
                      id: c.id,
                      name: c.name,
                      input: c.input,
                    }
                  }
                  return { type: 'text' as const, text: '' }
                })

                currentMessages = [
                  ...currentMessages,
                  {
                    role: 'assistant' as const,
                    content: assistantContent,
                  },
                  {
                    role: 'user' as const,
                    content: [
                      {
                        type: 'tool_result' as const,
                        tool_use_id: block.id,
                        content: toolResult.success
                          ? toolResult.message
                          : `Error: ${toolResult.message}`,
                      },
                    ],
                  },
                ]
              }
            }

            // Check if we should continue the loop
            continueLoop = response.stop_reason === 'tool_use'
          }

          // Save the assistant's response after all tool calls complete
          if (fullResponse) {
            const metadata: ChatMessageMetadata = {
              sources,
              tool_executions: toolResults.length > 0 ? toolResults : undefined,
            }
            const assistantMessage: ChatMessageInsert = {
              user_id: user.id,
              conversation_id: currentConversationId,
              role: 'assistant',
              content: fullResponse,
              metadata,
            }
            await supabase.from('chat_messages').insert(assistantMessage)
          }

          // Send done event
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                conversationId: currentConversationId,
                toolExecutions: toolResults,
              })}\n\n`
            )
          )
          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`
            )
          )
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response(JSON.stringify({ error: 'Chat failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// GET /api/chat - Get conversation history
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')

    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (conversationId) {
      query = query.eq('conversation_id', conversationId)
    }

    const { data: messages, error } = await query

    if (error) {
      throw error
    }

    return new Response(JSON.stringify(messages), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Get chat history error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get history' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Instructions for tool use added to system prompt
const TOOL_USE_INSTRUCTIONS = `

## Saving Data to EOS System

You have tools available to save data to Caldera's EOS system. Use these tools when:
1. You have gathered sufficient information through conversation
2. The user has confirmed they want to save the data
3. You have summarized what will be saved

**Important guidelines for tool use:**
- Always summarize the data you're about to save and ask for confirmation first
- After gathering information (e.g., accountability chart roles), present a clear summary
- Say something like: "Here's what I'll save to your [V/TO section]. Ready to save?"
- Wait for explicit confirmation before using the save tool
- After saving, confirm what was saved and suggest next steps

**Available tools:**
- save_accountability_chart: Save org structure to V/TO
- save_core_values: Save core values (3-7)
- save_core_focus: Save purpose and niche
- save_ten_year_target: Save the BHAG
- save_three_year_picture: Save 3-year vision
- save_one_year_plan: Save annual goals
- save_quarterly_rocks: Create rocks with owners
- save_scorecard_metrics: Create scorecard metrics
- save_issues: Add issues to the list

**Example flow:**
User: "Our core values are Integrity, Innovation, and Customer First"
You: "Great! I've captured your core values:
1. Integrity
2. Innovation
3. Customer First

Would you like me to save these to your V/TO?"
User: "Yes"
[You use save_core_values tool]
You: "Done! Your core values are now saved. Next, let's work on your Core Focus..."
`
