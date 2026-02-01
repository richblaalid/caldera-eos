import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui'
import {
  getActivePeriod,
  getCheckupPeriods,
  getCompletion,
  getPeriodStats,
  getHistoricalScores,
} from '@/lib/eos/checkup'
import type { ComponentScores } from '@/types/database'

// Component score progress bar
function ScoreBar({
  label,
  score,
  max,
  color = 'ember',
}: {
  label: string
  score: number
  max: number
  color?: string
}) {
  const percentage = (score / max) * 100

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium capitalize">{label}</span>
        <span className="text-muted-foreground">
          {score}/{max} ({Math.round(percentage)}%)
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full bg-${color}-500 rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

// Team progress indicator
function TeamProgress({
  completed,
  total,
}: {
  completed: number
  total: number
}) {
  const percentage = total > 0 ? (completed / total) * 100 : 0

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium">Team Progress</span>
          <span className="text-muted-foreground">
            {completed}/{total} completed
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// Score breakdown display
function ScoreBreakdown({ scores }: { scores: ComponentScores }) {
  const components: (keyof Omit<ComponentScores, 'total'>)[] = [
    'vision',
    'people',
    'data',
    'issues',
    'process',
    'traction',
  ]

  return (
    <div className="space-y-4">
      <div className="text-center p-4 bg-ember-50 dark:bg-ember-950/20 rounded-lg">
        <div className="text-4xl font-bold text-ember-600 dark:text-ember-400">
          {scores.total.score}
        </div>
        <div className="text-sm text-muted-foreground">out of {scores.total.max}</div>
      </div>
      <div className="space-y-3">
        {components.map(component => (
          <ScoreBar
            key={component}
            label={component}
            score={scores[component].score}
            max={scores[component].max}
          />
        ))}
      </div>
    </div>
  )
}

export default async function CheckupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Please log in to view checkup.</p>
      </div>
    )
  }

  // Get active period and user's completion status
  const activePeriod = await getActivePeriod()
  const periods = await getCheckupPeriods()
  const historicalScores = await getHistoricalScores()

  let userCompletion = null
  let periodStats = null

  if (activePeriod) {
    userCompletion = await getCompletion(activePeriod.id, user.id)
    periodStats = await getPeriodStats(activePeriod.id)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">EOS Organizational Checkup</h1>
          <p className="text-muted-foreground mt-1">
            Assess your organization&apos;s strength across the 6 EOS components
          </p>
        </div>
        <Link
          href="/dashboard/checkup/admin"
          className="text-sm text-ember-600 hover:text-ember-700 dark:text-ember-400"
        >
          Manage Periods
        </Link>
      </div>

      {/* Active Period Status */}
      {activePeriod ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Active
                  </span>
                  <h2 className="text-lg font-semibold text-foreground">{activePeriod.name}</h2>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {new Date(activePeriod.start_date).toLocaleDateString()} -{' '}
                  {new Date(activePeriod.end_date).toLocaleDateString()}
                </p>
              </div>

              {userCompletion ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">Completed</span>
                  </div>
                  <Link
                    href={`/dashboard/checkup/${activePeriod.id}`}
                    className="px-4 py-2 text-sm font-medium text-ember-600 hover:text-ember-700 dark:text-ember-400"
                  >
                    View Results
                  </Link>
                </div>
              ) : (
                <Link
                  href="/dashboard/checkup/assess"
                  className="px-6 py-2.5 bg-ember-500 text-white rounded-lg font-medium hover:bg-ember-600 transition-colors"
                >
                  Take Assessment
                </Link>
              )}
            </div>

            {/* Team Progress */}
            {periodStats && (
              <div className="mt-6 pt-6 border-t border-border">
                <TeamProgress
                  completed={periodStats.completedCount}
                  total={periodStats.totalMembers}
                />
                {periodStats.pendingMembers.length > 0 && (
                  <div className="mt-3 text-sm text-muted-foreground">
                    <span className="font-medium">Pending: </span>
                    {periodStats.pendingMembers.map(m => m.name || m.email).join(', ')}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <svg className="w-12 h-12 mx-auto text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-lg font-medium text-foreground mb-2">No Active Assessment</h3>
            <p className="text-muted-foreground mb-4">
              Create a new assessment period to start tracking your EOS health.
            </p>
            <Link
              href="/dashboard/checkup/admin"
              className="px-4 py-2 bg-ember-500 text-white rounded-lg font-medium hover:bg-ember-600 transition-colors inline-block"
            >
              Create Period
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Score Display */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Your Score */}
        {userCompletion && (
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Your Score</h3>
              <ScoreBreakdown
                scores={{
                  vision: { score: userCompletion.vision_score, max: 15 },
                  people: { score: userCompletion.people_score, max: 20 },
                  data: { score: userCompletion.data_score, max: 15 },
                  issues: { score: userCompletion.issues_score, max: 15 },
                  process: { score: userCompletion.process_score, max: 15 },
                  traction: { score: userCompletion.traction_score, max: 20 },
                  total: { score: userCompletion.total_score, max: 100 },
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Team Average */}
        {periodStats?.teamAverages && (
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Team Average</h3>
              <ScoreBreakdown scores={periodStats.teamAverages} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Historical Scores */}
      {historicalScores.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Historical Scores</h3>
            <div className="space-y-3">
              {historicalScores
                .filter(h => h.averageScore !== null)
                .map(h => (
                  <Link
                    key={h.period.id}
                    href={`/dashboard/checkup/${h.period.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div>
                      <span className="font-medium text-foreground">{h.period.name}</span>
                      <p className="text-sm text-muted-foreground">
                        {h.completionCount} {h.completionCount === 1 ? 'response' : 'responses'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-ember-600 dark:text-ember-400">
                        {h.averageScore}
                      </span>
                      <span className="text-sm text-muted-foreground">/100</span>
                    </div>
                  </Link>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Periods List */}
      {periods.length > 0 && !activePeriod && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Past Assessments</h3>
            <div className="space-y-2">
              {periods.map(period => (
                <Link
                  key={period.id}
                  href={`/dashboard/checkup/${period.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div>
                    <span className="font-medium text-foreground">{period.name}</span>
                    <p className="text-sm text-muted-foreground">
                      {new Date(period.start_date).toLocaleDateString()} -{' '}
                      {new Date(period.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
