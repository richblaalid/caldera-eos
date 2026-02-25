'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import type { Insight } from '@/types/database'
import { parseIssueSuggestion } from '@/lib/issue-suggestion-utils'

interface SuggestedIssuesProps {
  className?: string
}

export function SuggestedIssues({ className }: SuggestedIssuesProps) {
  const router = useRouter()
  const [suggestions, setSuggestions] = useState<Insight[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const res = await fetch('/api/insights/suggestions?type=issue&limit=15')
        if (res.ok) {
          const data = await res.json()
          setSuggestions(data.suggestions ?? data)
          setTotal(data.total ?? 0)
        }
      } catch (error) {
        console.error('Failed to fetch issue suggestions:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchSuggestions()
  }, [])

  const handleAccept = async (insight: Insight) => {
    setActing(insight.id)
    const data = parseIssueSuggestion(insight.content)
    if (!data) return

    try {
      const res = await fetch('/api/eos/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          description: data.description || null,
          priority: data.priority ?? 2,
          status: 'identified',
          source: 'transcript',
        }),
      })

      if (res.ok) {
        await fetch(`/api/insights/${insight.id}/dismiss`, { method: 'POST' })
        setSuggestions(prev => prev.filter(s => s.id !== insight.id))
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to create issue from suggestion:', error)
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Suggested Issues from Meetings
          <span className="text-xs font-normal text-muted-foreground">
            ({suggestions.length}{total > suggestions.length ? ` of ${total}` : ''})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Potential issues detected in meeting transcripts. Add them to your IDS list or dismiss.
        </p>
        {suggestions.map(suggestion => {
          const data = parseIssueSuggestion(suggestion.content)
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
                  {acting === suggestion.id ? 'Adding...' : 'Add as Issue'}
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
