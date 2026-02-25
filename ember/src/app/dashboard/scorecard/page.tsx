import Link from 'next/link'
import { getMetrics, getAllMetricEntries } from '@/lib/eos'
import { Card, CardContent } from '@/components/ui'
import { SuggestedMetrics } from '@/components/scorecard/SuggestedMetrics'
import { WeekRangeSelector } from '@/components/scorecard/WeekRangeSelector'
import type { ScorecardMetric, ScorecardEntry, Profile } from '@/types/database'

type MetricWithOwner = ScorecardMetric & { owner: Profile | null }

// Helper to get the start of the week (Monday)
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday as first day
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Helper to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// Get the date range for a named period
function getDateRange(range: string): { start: Date; end: Date } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed

  switch (range) {
    case 'this-quarter': {
      const qStart = new Date(year, Math.floor(month / 3) * 3, 1)
      return { start: qStart, end: now }
    }
    case 'last-quarter': {
      const currentQStart = Math.floor(month / 3) * 3
      const lqStart = new Date(year, currentQStart - 3, 1)
      const lqEnd = new Date(year, currentQStart, 0) // last day of prev quarter
      return { start: lqStart, end: lqEnd }
    }
    case 'ytd': {
      return { start: new Date(year, 0, 1), end: now }
    }
    case 'last-year': {
      return { start: new Date(year - 1, 0, 1), end: new Date(year - 1, 11, 31) }
    }
    case 'trailing-13':
    default: {
      const start = new Date(now)
      start.setDate(start.getDate() - 13 * 7)
      return { start, end: now }
    }
  }
}

// Generate array of week start dates within a date range (chronological: oldest first)
function getWeeksInRange(range: string): string[] {
  const { start, end } = getDateRange(range)
  const weeks: string[] = []
  const endWeek = getWeekStart(end)
  const startWeek = getWeekStart(start)

  const current = new Date(startWeek)
  while (current <= endWeek) {
    weeks.push(formatDate(current))
    current.setDate(current.getDate() + 7)
  }

  return weeks
}

// Format week for display
function formatWeekDisplay(dateStr: string): string {
  const date = new Date(dateStr)
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const day = date.getDate()
  return `${month} ${day}`
}

// Determine cell status color
function getCellStatus(
  value: number | null | undefined,
  target: number | null,
  direction: string
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (value === null || value === undefined || target === null) {
    return 'neutral'
  }

  const threshold = target * 0.1 // 10% threshold for warning

  if (direction === 'above') {
    if (value >= target) return 'success'
    if (value >= target - threshold) return 'warning'
    return 'danger'
  } else if (direction === 'below') {
    if (value <= target) return 'success'
    if (value <= target + threshold) return 'warning'
    return 'danger'
  } else {
    // equal
    if (Math.abs(value - target) <= threshold) return 'success'
    return 'warning'
  }
}

// Trend arrow component
function TrendArrow({
  current,
  previous,
  direction
}: {
  current: number | null | undefined
  previous: number | null | undefined
  direction: string
}) {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return null
  }

  const diff = current - previous
  if (Math.abs(diff) < 0.001) return null // No significant change

  // Determine if the trend is good or bad based on goal direction
  const isUp = diff > 0
  const isGoodTrend = (direction === 'above' && isUp) || (direction === 'below' && !isUp)

  return (
    <span className={`ml-1 text-xs ${isGoodTrend ? 'text-success' : 'text-danger'}`}>
      {isUp ? '↑' : '↓'}
    </span>
  )
}

// Format a metric value with its unit for compact display
function formatMetricValue(value: number, unit: string | null): string {
  if (!unit) return value.toLocaleString()

  switch (unit) {
    case '$':
      if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
      if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
      return `$${value.toLocaleString()}`
    case '%':
      return `${value}%`
    case 'months':
      return `${value} mo`
    default:
      return `${value.toLocaleString()} ${unit}`
  }
}

// Format target value with unit
function formatTargetValue(target: number, unit: string | null): string {
  if (!unit) return target.toLocaleString()

  switch (unit) {
    case '$':
      if (target >= 1_000_000) return `$${(target / 1_000_000).toFixed(1)}M`
      if (target >= 1_000) return `$${Math.round(target / 1_000)}K`
      return `$${target.toLocaleString()}`
    case '%':
      return `${target}%`
    case 'months':
      return `${target} mo`
    default:
      return `${target.toLocaleString()} ${unit}`
  }
}

// Cell component
function MetricCell({
  value,
  prevValue,
  target,
  direction,
  unit
}: {
  value: number | null | undefined
  prevValue: number | null | undefined
  target: number | null
  direction: string
  unit: string | null
}) {
  const status = getCellStatus(value, target, direction)

  const statusColors = {
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-amber-700',
    danger: 'bg-danger/10 text-danger',
    neutral: 'bg-muted text-muted-foreground',
  }

  const displayValue = value !== null && value !== undefined
    ? formatMetricValue(value, unit)
    : '-'

  return (
    <td className={`px-3 py-2 text-center text-sm font-medium whitespace-nowrap ${statusColors[status]}`}>
      <span className="inline-flex items-center">
        {displayValue}
        <TrendArrow current={value} previous={prevValue} direction={direction} />
      </span>
    </td>
  )
}

// Empty state
function EmptyState() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="text-muted-foreground mb-4">
          No scorecard metrics defined yet.
        </p>
        <Link
          href="/dashboard/scorecard/metrics/new"
          className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg bg-ember-600 text-white hover:bg-ember-700 transition-colors"
        >
          Add Your First Metric
        </Link>
      </CardContent>
    </Card>
  )
}

interface PageProps {
  searchParams: Promise<{ range?: string }>
}

export default async function ScorecardPage({ searchParams }: PageProps) {
  const params = await searchParams
  const range = params.range || 'this-quarter'

  // Get all weeks we want to display (chronological: oldest first)
  const weeks = getWeeksInRange(range)
  const weekStart = weeks[0] // Oldest week
  const weekEnd = weeks[weeks.length - 1] // Most recent week

  // Fetch metrics and entries in parallel
  const [metrics, entries] = await Promise.all([
    getMetrics(),
    getAllMetricEntries(weekStart, weekEnd)
  ])

  // Build a map of entries by metric_id and week_of
  const entryMap = new Map<string, ScorecardEntry>()
  entries.forEach(entry => {
    const key = `${entry.metric_id}-${entry.week_of}`
    entryMap.set(key, entry)
  })

  if (metrics.length === 0) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Scorecard</h1>
            <p className="text-muted-foreground mt-1">
              Weekly metrics and KPIs
            </p>
          </div>
        </div>
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Scorecard</h1>
          <p className="text-muted-foreground mt-1">
            Weekly metrics and KPIs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <WeekRangeSelector value={range} />
          <Link
            href="/dashboard/scorecard/entry"
            className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg bg-ember-600 text-white hover:bg-ember-700 transition-colors"
          >
            Enter Data
          </Link>
          <Link
            href="/dashboard/scorecard/metrics/new"
            className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors"
          >
            Add Metric
          </Link>
        </div>
      </div>

      {/* Scorecard Grid */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground sticky left-0 bg-background z-10 min-w-[200px]">
                  Metric
                </th>
                <th className="px-3 py-3 text-center text-sm font-semibold text-foreground w-16">
                  Target
                </th>
                <th className="px-3 py-3 text-center text-sm font-semibold text-foreground w-20">
                  Owner
                </th>
                {weeks.map((week) => (
                  <th
                    key={week}
                    className="px-3 py-3 text-center text-sm font-medium text-muted-foreground w-20"
                  >
                    {formatWeekDisplay(week)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric: MetricWithOwner) => (
                <tr key={metric.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3 sticky left-0 bg-background z-10">
                    <Link
                      href={`/dashboard/scorecard/metrics/${metric.id}`}
                      className="font-medium text-foreground hover:text-ember-600"
                    >
                      {metric.name}
                    </Link>
                    {metric.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {metric.description}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-sm text-foreground whitespace-nowrap">
                    {metric.target !== null ? (
                      <>
                        {metric.goal_direction === 'above' && '≥ '}
                        {metric.goal_direction === 'below' && '≤ '}
                        {metric.goal_direction === 'equal' && '= '}
                        {formatTargetValue(metric.target, metric.unit)}
                      </>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-sm text-muted-foreground">
                    {metric.owner?.name?.split(' ')[0] || '-'}
                  </td>
                  {weeks.map((week, index) => {
                    const entry = entryMap.get(`${metric.id}-${week}`)
                    // Get previous week's value for trend arrow (index-1 = earlier week)
                    const prevWeek = index > 0 ? weeks[index - 1] : undefined
                    const prevEntry = prevWeek ? entryMap.get(`${metric.id}-${prevWeek}`) : undefined
                    return (
                      <MetricCell
                        key={week}
                        value={entry?.value}
                        prevValue={prevEntry?.value}
                        target={metric.target}
                        direction={metric.goal_direction}
                        unit={metric.unit}
                      />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Suggested Metrics from Transcripts */}
      <SuggestedMetrics />

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-success/20 border border-success/30" />
          <span className="text-muted-foreground">On Target</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-warning/20 border border-warning/30" />
          <span className="text-muted-foreground">Near Target</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-danger/20 border border-danger/30" />
          <span className="text-muted-foreground">Off Target</span>
        </div>
      </div>
    </div>
  )
}
