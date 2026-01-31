'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'
import type { ScorecardMetric, ScorecardEntry, Profile } from '@/types/database'

type MetricWithOwner = ScorecardMetric & { owner: Profile | null }

// Helper to get the start of the week (Monday)
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Helper to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// Format week for display
function formatWeekDisplay(dateStr: string): string {
  const date = new Date(dateStr)
  const endDate = new Date(date)
  endDate.setDate(endDate.getDate() + 6)

  const startMonth = date.toLocaleDateString('en-US', { month: 'short' })
  const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' })

  if (startMonth === endMonth) {
    return `${startMonth} ${date.getDate()}-${endDate.getDate()}`
  }
  return `${startMonth} ${date.getDate()} - ${endMonth} ${endDate.getDate()}`
}

// Generate recent weeks
function getRecentWeeks(count: number): string[] {
  const weeks: string[] = []
  const now = new Date()
  const currentWeekStart = getWeekStart(now)

  for (let i = 0; i < count; i++) {
    const weekStart = new Date(currentWeekStart)
    weekStart.setDate(weekStart.getDate() - (i * 7))
    weeks.push(formatDate(weekStart))
  }

  return weeks
}

interface EntryState {
  [metricId: string]: {
    value: string
    notes: string
    originalValue: string
    originalNotes: string
  }
}

export default function ScorecardEntryPage() {
  const router = useRouter()
  const [metrics, setMetrics] = useState<MetricWithOwner[]>([])
  const [entries, setEntries] = useState<EntryState>({})
  const [selectedWeek, setSelectedWeek] = useState(formatDate(getWeekStart(new Date())))
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const recentWeeks = getRecentWeeks(8)

  // Fetch metrics and existing entries
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch metrics
        const metricsRes = await fetch('/api/eos/scorecard/metrics')
        if (!metricsRes.ok) throw new Error('Failed to fetch metrics')
        const metricsData = await metricsRes.json()
        setMetrics(metricsData)

        // Fetch existing entries for selected week
        const entriesRes = await fetch(
          `/api/eos/scorecard/entries?week_start=${selectedWeek}&week_end=${selectedWeek}`
        )
        if (!entriesRes.ok) throw new Error('Failed to fetch entries')
        const entriesData: ScorecardEntry[] = await entriesRes.json()

        // Build entries state
        const entriesMap: EntryState = {}
        metricsData.forEach((metric: MetricWithOwner) => {
          const existingEntry = entriesData.find(e => e.metric_id === metric.id)
          entriesMap[metric.id] = {
            value: existingEntry?.value?.toString() ?? '',
            notes: existingEntry?.notes ?? '',
            originalValue: existingEntry?.value?.toString() ?? '',
            originalNotes: existingEntry?.notes ?? '',
          }
        })
        setEntries(entriesMap)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [selectedWeek])

  const handleValueChange = (metricId: string, value: string) => {
    setEntries(prev => ({
      ...prev,
      [metricId]: {
        ...prev[metricId],
        value,
      },
    }))
    setSaveStatus('idle')
  }

  const handleNotesChange = (metricId: string, notes: string) => {
    setEntries(prev => ({
      ...prev,
      [metricId]: {
        ...prev[metricId],
        notes,
      },
    }))
    setSaveStatus('idle')
  }

  const hasChanges = () => {
    return Object.entries(entries).some(([_, entry]) =>
      entry.value !== entry.originalValue || entry.notes !== entry.originalNotes
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSaveStatus('saving')

    try {
      // Collect all entries that have values
      const entriesToSave = Object.entries(entries)
        .filter(([_, entry]) => entry.value !== '')
        .map(([metricId, entry]) => ({
          metric_id: metricId,
          week_of: selectedWeek,
          value: parseFloat(entry.value),
          notes: entry.notes || null,
        }))

      if (entriesToSave.length === 0) {
        setSaveStatus('idle')
        setIsSaving(false)
        return
      }

      const res = await fetch('/api/eos/scorecard/entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: entriesToSave }),
      })

      if (!res.ok) {
        throw new Error('Failed to save entries')
      }

      // Update original values
      setEntries(prev => {
        const updated: EntryState = {}
        Object.entries(prev).forEach(([id, entry]) => {
          updated[id] = {
            ...entry,
            originalValue: entry.value,
            originalNotes: entry.notes,
          }
        })
        return updated
      })

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setSaveStatus('idle')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/scorecard" className="hover:text-foreground">
          Scorecard
        </Link>
        <span>/</span>
        <span className="text-foreground">Enter Data</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Enter Weekly Data</h1>
          <p className="text-muted-foreground mt-1">
            Record your metrics for the selected week
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saved' && (
            <span className="text-sm text-success">Saved!</span>
          )}
          <Button
            onClick={handleSave}
            isLoading={isSaving}
            disabled={!hasChanges()}
          >
            Save All
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-danger/10 text-danger rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Week Selector */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-foreground">
              Week of:
            </label>
            <div className="flex gap-2 flex-wrap">
              {recentWeeks.map((week) => (
                <button
                  key={week}
                  onClick={() => setSelectedWeek(week)}
                  className={`
                    px-3 py-1.5 text-sm rounded-lg transition-colors
                    ${selectedWeek === week
                      ? 'bg-ember-600 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }
                  `}
                >
                  {formatWeekDisplay(week)}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Entry Form */}
      {metrics.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No metrics defined yet.
            </p>
            <Link
              href="/dashboard/scorecard/metrics/new"
              className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg bg-ember-600 text-white hover:bg-ember-700 transition-colors"
            >
              Add Your First Metric
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {metrics.map((metric) => {
            const entry = entries[metric.id] || { value: '', notes: '' }

            return (
              <Card key={metric.id}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-foreground">
                          {metric.name}
                        </span>
                        {metric.target !== null && (
                          <span className="text-xs text-muted-foreground">
                            Target: {metric.goal_direction === 'above' && '≥ '}
                            {metric.goal_direction === 'below' && '≤ '}
                            {metric.goal_direction === 'equal' && '= '}
                            {metric.target}{metric.unit && ` ${metric.unit}`}
                          </span>
                        )}
                      </div>
                      {metric.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {metric.description}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Value{metric.unit && ` (${metric.unit})`}
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={entry.value}
                            onChange={(e) => handleValueChange(metric.id, e.target.value)}
                            placeholder="Enter value"
                            className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-ember-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Notes (optional)
                          </label>
                          <input
                            type="text"
                            value={entry.notes}
                            onChange={(e) => handleNotesChange(metric.id, e.target.value)}
                            placeholder="Add notes"
                            className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-ember-500"
                          />
                        </div>
                      </div>
                    </div>
                    {metric.owner && (
                      <div className="text-xs text-muted-foreground">
                        {metric.owner.name?.split(' ')[0]}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Save Button (fixed at bottom on mobile) */}
      <div className="flex justify-end gap-3 pb-4">
        <Button variant="outline" onClick={() => router.push('/dashboard/scorecard')}>
          Cancel
        </Button>
        <Button onClick={handleSave} isLoading={isSaving} disabled={!hasChanges()}>
          Save All Changes
        </Button>
      </div>
    </div>
  )
}
