import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/claude'
import { buildDynamicSystemPrompt } from '@/lib/ember'
import { retrieveContext, buildChatContext } from '@/lib/context'
import type { ChatMessageInsert, ChatMessageMetadata } from '@/types/database'

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
    const systemPrompt = basePrompt + contextString

    // Create streaming response
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    })

    // Track sources for metadata
    const sources = context.sources

    // Create a TransformStream to handle the streaming
    const encoder = new TextEncoder()
    let fullResponse = ''

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              const text = event.delta.text
              fullResponse += text
              // Send as SSE format
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
              )
            }
          }

          // Save the assistant's response after streaming completes
          if (fullResponse) {
            const metadata: ChatMessageMetadata = {
              sources,
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
              `data: ${JSON.stringify({ done: true, conversationId: currentConversationId })}\n\n`
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
