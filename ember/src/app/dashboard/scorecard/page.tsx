import Link from 'next/link'
import { getMetrics, getAllMetricEntries } from '@/lib/eos'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
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

// Generate array of week start dates
function getWeeks(count: number): string[] {
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
    ? `${value}${unit ? ` ${unit}` : ''}`
    : '-'

  return (
    <td className={`px-3 py-2 text-center text-sm font-medium ${statusColors[status]}`}>
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
  searchParams: Promise<{ weeks?: string }>
}

export default async function ScorecardPage({ searchParams }: PageProps) {
  const params = await searchParams
  const weekCount = parseInt(params.weeks || '13', 10) // Default to 13 weeks (quarter)

  // Get all weeks we want to display
  const weeks = getWeeks(weekCount)
  const weekStart = weeks[weeks.length - 1] // Oldest week
  const weekEnd = weeks[0] // Most recent week

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
          <select
            defaultValue={weekCount.toString()}
            className="h-10 px-3 text-sm rounded-lg border border-border bg-background"
          >
            <option value="4">4 weeks</option>
            <option value="8">8 weeks</option>
            <option value="13">13 weeks (Quarter)</option>
            <option value="26">26 weeks</option>
          </select>
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
                  <td className="px-3 py-3 text-center text-sm text-foreground">
                    {metric.target !== null ? (
                      <>
                        {metric.goal_direction === 'above' && '≥ '}
                        {metric.goal_direction === 'below' && '≤ '}
                        {metric.goal_direction === 'equal' && '= '}
                        {metric.target}
                        {metric.unit && ` ${metric.unit}`}
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
                    // Get previous week's value for trend arrow
                    const prevWeek = weeks[index + 1]
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
