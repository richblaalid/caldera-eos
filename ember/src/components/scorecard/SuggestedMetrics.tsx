'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import type { Insight } from '@/types/database'
import { parseMetricSuggestion } from '@/lib/metric-suggestions'

interface SuggestedMetricsProps {
  className?: string
}

export function SuggestedMetrics({ className }: SuggestedMetricsProps) {
  const router = useRouter()
  const [suggestions, setSuggestions] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissing, setDismissing] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const res = await fetch('/api/insights/suggestions')
        if (res.ok) {
          const data = await res.json()
          setSuggestions(data)
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchSuggestions()
  }, [])

  const handleAccept = (insight: Insight) => {
    // Parse the metric data from the insight content
    const metricData = parseMetricSuggestion(insight.content)
    if (!metricData) return

    // Navigate to new metric page with pre-populated data
    const params = new URLSearchParams({
      name: metricData.name,
      ...(metricData.description && { description: metricData.description }),
      ...(metricData.suggested_target && { target: metricData.suggested_target }),
      ...(metricData.owner && { owner: metricData.owner }),
      ...(metricData.frequency && { frequency: metricData.frequency }),
      insightId: insight.id,
    })
    router.push(`/dashboard/scorecard/metrics/new?${params.toString()}`)
  }

  const handleDismiss = async (insightId: string) => {
    setDismissing(insightId)
    try {
      const res = await fetch(`/api/insights/${insightId}/dismiss`, {
        method: 'POST',
      })
      if (res.ok) {
        setSuggestions((prev) => prev.filter((s) => s.id !== insightId))
      }
    } catch (error) {
      console.error('Failed to dismiss suggestion:', error)
    } finally {
      setDismissing(null)
    }
  }

  // Don't render anything if loading or no suggestions
  if (loading || suggestions.length === 0) {
    return null
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-ember-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          Suggested Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          These metrics were detected in meeting transcripts and may be worth tracking.
        </p>
        {suggestions.map((suggestion) => {
          const metricData = parseMetricSuggestion(suggestion.content)
          if (!metricData) return null

          return (
            <div
              key={suggestion.id}
              className="p-4 border rounded-lg bg-muted/30 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">{metricData.name}</h4>
                  {metricData.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {metricData.description}
                    </p>
                  )}
                  {metricData.context && (
                    <p className="text-sm text-muted-foreground mt-2 italic">
                      &ldquo;{metricData.context}&rdquo;
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {metricData.suggested_target && (
                      <span className="text-xs px-2 py-1 rounded bg-ember-100 text-ember-700">
                        Target: {metricData.suggested_target}
                      </span>
                    )}
                    {metricData.frequency && (
                      <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                        {metricData.frequency}
                      </span>
                    )}
                    {metricData.owner && (
                      <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                        Owner: {metricData.owner}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => handleAccept(suggestion)}>
                  Add to Scorecard
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDismiss(suggestion.id)}
                  disabled={dismissing === suggestion.id}
                >
                  {dismissing === suggestion.id ? 'Dismissing...' : 'Dismiss'}
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
