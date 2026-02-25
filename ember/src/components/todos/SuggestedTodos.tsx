'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import type { Insight } from '@/types/database'
import { parseTodoSuggestion } from '@/lib/todo-suggestion-utils'

interface SuggestedTodosProps {
  className?: string
}

export function SuggestedTodos({ className }: SuggestedTodosProps) {
  const router = useRouter()
  const [suggestions, setSuggestions] = useState<Insight[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const res = await fetch('/api/insights/suggestions?type=todo&limit=10')
        if (res.ok) {
          const data = await res.json()
          setSuggestions(data.suggestions ?? data)
          setTotal(data.total ?? 0)
        }
      } catch (error) {
        console.error('Failed to fetch todo suggestions:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchSuggestions()
  }, [])

  const handleAccept = async (insight: Insight) => {
    setActing(insight.id)
    const data = parseTodoSuggestion(insight.content)
    if (!data) return

    try {
      // Default 7-day due date per EOS standard
      const dueDate = data.due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const res = await fetch('/api/eos/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          description: data.description || null,
          due_date: dueDate,
        }),
      })

      if (res.ok) {
        await fetch(`/api/insights/${insight.id}/dismiss`, { method: 'POST' })
        setSuggestions(prev => prev.filter(s => s.id !== insight.id))
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to create todo from suggestion:', error)
    } finally {
      setActing(null)
    }
  }

  const handleDismiss = async (insightId: string) => {
    setActing(insightId)
    try {
      const res = await fetch(`/api/insights/${insightId}/dismiss`, { method: 'POST' })
      if (res.ok) {
        setSuggestions(prev => prev.filter(s => s.id !== insightId))
      }
    } catch (error) {
      console.error('Failed to dismiss suggestion:', error)
    } finally {
      setActing(null)
    }
  }

  if (loading || suggestions.length === 0) return null

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <svg className="w-5 h-5 text-ember-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Suggested To-dos from Meetings
          <span className="text-xs font-normal text-muted-foreground">
            ({suggestions.length}{total > suggestions.length ? ` of ${total}` : ''})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Action items detected in meeting transcripts. Add them as to-dos or dismiss.
        </p>
        {suggestions.map(suggestion => {
          const data = parseTodoSuggestion(suggestion.content)
          if (!data) return null

          const source = (suggestion.sources as Array<{ title: string }>)?.[0]

          return (
            <div key={suggestion.id} className="p-4 border rounded-lg bg-muted/30 space-y-2">
              <div className="flex-1">
                <h4 className="font-semibold text-foreground">{data.title}</h4>
                {data.description && (
                  <p className="text-sm text-muted-foreground mt-1">{data.description}</p>
                )}
                {data.context && (
                  <p className="text-sm text-muted-foreground mt-2 italic">
                    &ldquo;{data.context}&rdquo;
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {data.owner && (
                    <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      Owner: {data.owner}
                    </span>
                  )}
                  {data.priority && (
                    <span className={`text-xs px-2 py-1 rounded ${
                      data.priority === 1
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        : data.priority === 2
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}>
                      P{data.priority}
                    </span>
                  )}
                  {source?.title && (
                    <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      From: {source.title}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => handleAccept(suggestion)}
                  disabled={acting === suggestion.id}
                >
                  {acting === suggestion.id ? 'Adding...' : 'Add as To-do'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDismiss(suggestion.id)}
                  disabled={acting === suggestion.id}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
