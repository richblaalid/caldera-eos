'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, Button } from '@/components/ui'
import { COACHING_PROMPTS, FOCUS_DAY_PROMPTS, VTO_PROMPTS } from '@/lib/ember'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

type PromptCategory = 'focus-day' | 'vto' | 'l10'

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [promptCategory, setPromptCategory] = useState<PromptCategory>('focus-day')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea when input changes (including programmatic changes)
  useEffect(() => {
    const textarea = inputRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px'
    }
  }, [input])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
    }

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      isStreaming: true,
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          conversationId,
        }),
      })

      if (!response.ok) {
        throw new Error('Chat request failed')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response stream')
      }

      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.text) {
                fullContent += data.text
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, content: fullContent }
                      : m
                  )
                )
              }

              if (data.done && data.conversationId) {
                setConversationId(data.conversationId)
              }

              if (data.error) {
                throw new Error(data.error)
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }

      // Mark streaming as complete
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id ? { ...m, isStreaming: false } : m
        )
      )
    } catch (error) {
      console.error('Chat error:', error)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id
            ? {
                ...m,
                content: 'Sorry, I encountered an error. Please try again.',
                isStreaming: false,
              }
            : m
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const usePrompt = (prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  const startNewConversation = () => {
    setMessages([])
    setConversationId(null)
    setInput('')
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Chat with Ember</h1>
          <p className="text-muted-foreground text-sm">
            Your EOS coaching partner
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={startNewConversation}>
            New Conversation
          </Button>
        )}
      </div>

      {/* Chat Container */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-ember-100 flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-ember-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">
                Hi, I&apos;m Ember
              </h2>
              <p className="text-muted-foreground mb-4 max-w-md">
                I&apos;m your EOS coaching partner. I can help you prepare for Focus Day,
                build your V/TO, or run effective L10 meetings.
              </p>

              {/* Category Tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setPromptCategory('focus-day')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    promptCategory === 'focus-day'
                      ? 'bg-ember-600 text-white'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Focus Day
                </button>
                <button
                  onClick={() => setPromptCategory('vto')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    promptCategory === 'vto'
                      ? 'bg-ember-600 text-white'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  V/TO Building
                </button>
                <button
                  onClick={() => setPromptCategory('l10')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    promptCategory === 'l10'
                      ? 'bg-ember-600 text-white'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  L10 Meetings
                </button>
              </div>

              {/* Quick Prompts - Focus Day */}
              {promptCategory === 'focus-day' && (
                <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                  <button
                    onClick={() => usePrompt(FOCUS_DAY_PROMPTS.overview)}
                    className="p-3 text-left text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground">Focus Day Overview</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Understand what to expect
                    </p>
                  </button>
                  <button
                    onClick={() => usePrompt(FOCUS_DAY_PROMPTS.accountabilityChart)}
                    className="p-3 text-left text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground">Accountability Chart</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Define roles and seats
                    </p>
                  </button>
                  <button
                    onClick={() => usePrompt(FOCUS_DAY_PROMPTS.rocks)}
                    className="p-3 text-left text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground">Discover Rocks</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Identify 90-day priorities
                    </p>
                  </button>
                  <button
                    onClick={() => usePrompt(FOCUS_DAY_PROMPTS.scorecard)}
                    className="p-3 text-left text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground">Build Scorecard</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Define weekly metrics
                    </p>
                  </button>
                  <button
                    onClick={() => usePrompt(FOCUS_DAY_PROMPTS.issuesList)}
                    className="p-3 text-left text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground">Issues List</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Capture obstacles and opportunities
                    </p>
                  </button>
                  <button
                    onClick={() => usePrompt(FOCUS_DAY_PROMPTS.l10Format)}
                    className="p-3 text-left text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground">L10 Format</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Learn the meeting structure
                    </p>
                  </button>
                </div>
              )}

              {/* Quick Prompts - VTO */}
              {promptCategory === 'vto' && (
                <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                  <button
                    onClick={() => usePrompt(VTO_PROMPTS.coreValues)}
                    className="p-3 text-left text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground">Core Values</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Discover your culture
                    </p>
                  </button>
                  <button
                    onClick={() => usePrompt(VTO_PROMPTS.coreFocus)}
                    className="p-3 text-left text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground">Core Focus</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Purpose and niche
                    </p>
                  </button>
                  <button
                    onClick={() => usePrompt(VTO_PROMPTS.tenYearTarget)}
                    className="p-3 text-left text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground">10-Year Target</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your big audacious goal
                    </p>
                  </button>
                  <button
                    onClick={() => usePrompt(VTO_PROMPTS.marketingStrategy)}
                    className="p-3 text-left text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground">Marketing Strategy</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Target, Uniques, Process
                    </p>
                  </button>
                  <button
                    onClick={() => usePrompt(VTO_PROMPTS.threeYearPicture)}
                    className="p-3 text-left text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground">3-Year Picture</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Vivid future state
                    </p>
                  </button>
                  <button
                    onClick={() => usePrompt(VTO_PROMPTS.oneYearPlan)}
                    className="p-3 text-left text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground">1-Year Plan</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Annual goals
                    </p>
                  </button>
                </div>
              )}

              {/* Quick Prompts - L10 */}
              {promptCategory === 'l10' && (
                <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                  <button
                    onClick={() => usePrompt(COACHING_PROMPTS.l10Prep)}
                    className="p-3 text-left text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground">L10 Prep</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Prepare for your next meeting
                    </p>
                  </button>
                  <button
                    onClick={() => usePrompt(COACHING_PROMPTS.rockReview)}
                    className="p-3 text-left text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground">Rock Review</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Check Rock progress
                    </p>
                  </button>
                  <button
                    onClick={() => usePrompt(COACHING_PROMPTS.scorecardAnalysis)}
                    className="p-3 text-left text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground">Scorecard</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Analyze metrics trends
                    </p>
                  </button>
                  <button
                    onClick={() => usePrompt(COACHING_PROMPTS.accountabilityCheck)}
                    className="p-3 text-left text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground">Accountability</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Review commitments
                    </p>
                  </button>
                  <button
                    onClick={() => usePrompt(COACHING_PROMPTS.issueIDS)}
                    className="p-3 text-left text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors col-span-2"
                  >
                    <span className="font-medium text-foreground">IDS an Issue</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Identify, Discuss, Solve a problem
                    </p>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-ember-600 text-white'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    {message.isStreaming && (
                      <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </CardContent>

        {/* Input */}
        <div className="border-t border-border p-4">
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask Ember about your EOS data..."
              rows={1}
              className="flex-1 min-h-[42px] max-h-[300px] resize-none rounded-lg border border-border bg-background px-4 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ember-500 disabled:opacity-50"
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              isLoading={isLoading}
              className="h-[42px]"
            >
              Send
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </Card>
    </div>
  )
}
