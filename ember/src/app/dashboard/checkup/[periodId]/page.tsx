import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui'
import { getCheckupPeriod, getPeriodStats, getCompletion } from '@/lib/eos/checkup'
import type { ComponentScores, EOSComponent } from '@/types/database'

const COMPONENT_LABELS: Record<EOSComponent, string> = {
  vision: 'Vision',
  people: 'People',
  data: 'Data',
  issues: 'Issues',
  process: 'Process',
  traction: 'Traction',
}

// Score bar with comparison
function CompareBar({
  label,
  yourScore,
  teamScore,
  max,
}: {
  label: string
  yourScore: number | null
  teamScore: number | null
  max: number
}) {
  const yourPercent = yourScore !== null ? (yourScore / max) * 100 : 0
  const teamPercent = teamScore !== null ? (teamScore / max) * 100 : 0

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium capitalize">{label}</span>
        <span className="text-muted-foreground">Max: {max}</span>
      </div>
      <div className="space-y-1">
        {/* Your score */}
        {yourScore !== null && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-12">You</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-ember-500 rounded-full transition-all duration-500"
                style={{ width: `${yourPercent}%` }}
              />
            </div>
            <span className="text-sm font-medium w-8 text-right">{yourScore}</span>
          </div>
        )}
        {/* Team average */}
        {teamScore !== null && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-12">Team</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${teamPercent}%` }}
              />
            </div>
            <span className="text-sm font-medium w-8 text-right">{teamScore}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Total score display
function TotalScore({
  score,
  label,
  color,
}: {
  score: number
  label: string
  color: 'ember' | 'blue'
}) {
  return (
    <div className="text-center p-4 bg-muted/50 rounded-lg">
      <div className={`text-4xl font-bold ${
        color === 'ember' ? 'text-ember-600 dark:text-ember-400' : 'text-blue-600 dark:text-blue-400'
      }`}>
        {score}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-xs text-muted-foreground mt-1">out of 100</div>
    </div>
  )
}

// Team member completion card
function CompletionCard({
  name,
  score,
  completedAt,
}: {
  name: string
  score: number
  completedAt: string
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
      <div>
        <span className="font-medium text-foreground">{name}</span>
        <p className="text-xs text-muted-foreground">
          {new Date(completedAt).toLocaleDateString()}
        </p>
      </div>
      <div className="text-right">
        <span className="text-xl font-bold text-ember-600 dark:text-ember-400">{score}</span>
        <span className="text-sm text-muted-foreground">/100</span>
      </div>
    </div>
  )
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ periodId: string }>
}) {
  const { periodId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Please log in to view results.</p>
      </div>
    )
  }

  let period
  let periodStats
  let userCompletion

  try {
    period = await getCheckupPeriod(periodId)
    periodStats = await getPeriodStats(periodId)
    userCompletion = await getCompletion(periodId, user.id)
  } catch {
    notFound()
  }

  const components: EOSComponent[] = ['vision', 'people', 'data', 'issues', 'process', 'traction']
  const maxScores: Record<EOSComponent, number> = {
    vision: 15,
    people: 20,
    data: 15,
    issues: 15,
    process: 15,
    traction: 20,
  }

  const yourScores = userCompletion
    ? {
        vision: userCompletion.vision_score,
        people: userCompletion.people_score,
        data: userCompletion.data_score,
        issues: userCompletion.issues_score,
        process: userCompletion.process_score,
        traction: userCompletion.traction_score,
        total: userCompletion.total_score,
      }
    : null

  const teamScores = periodStats.teamAverages

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/checkup"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Checkup
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">{period.name}</h1>
          <p className="text-muted-foreground mt-1">
            {new Date(period.start_date).toLocaleDateString()} -{' '}
            {new Date(period.end_date).toLocaleDateString()}
          </p>
        </div>
        {period.is_active && !userCompletion && (
          <Link
            href="/dashboard/checkup/assess"
            className="px-4 py-2 bg-ember-500 text-white rounded-lg font-medium hover:bg-ember-600 transition-colors"
          >
            Take Assessment
          </Link>
        )}
      </div>

      {/* Total Scores Overview */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Score Overview</h2>
          <div className="grid grid-cols-2 gap-4">
            {yourScores && (
              <TotalScore score={yourScores.total} label="Your Score" color="ember" />
            )}
            {teamScores && (
              <TotalScore score={teamScores.total.score} label="Team Average" color="blue" />
            )}
          </div>
          {!yourScores && !teamScores && (
            <p className="text-center text-muted-foreground py-8">
              No scores available yet. Be the first to complete the assessment!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Component Breakdown */}
      {(yourScores || teamScores) && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Component Breakdown</h2>
              <div className="flex items-center gap-4 text-sm">
                {yourScores && (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-ember-500 rounded-full" />
                    You
                  </span>
                )}
                {teamScores && (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-blue-500 rounded-full" />
                    Team
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-4">
              {components.map(component => (
                <CompareBar
                  key={component}
                  label={COMPONENT_LABELS[component]}
                  yourScore={yourScores ? yourScores[component] : null}
                  teamScore={teamScores ? teamScores[component].score : null}
                  max={maxScores[component]}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Completions */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Team Completions</h2>
          {periodStats.completions.length > 0 ? (
            <div className="space-y-3">
              {periodStats.completions.map(completion => (
                <CompletionCard
                  key={completion.id}
                  name={completion.user?.name || completion.user?.email || 'Unknown'}
                  score={completion.total_score}
                  completedAt={completion.completed_at}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No one has completed this assessment yet.
            </p>
          )}

          {/* Pending members */}
          {periodStats.pendingMembers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Still pending: </span>
                {periodStats.pendingMembers.map(m => m.name || m.email).join(', ')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interpretation Guide */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Score Interpretation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <span className="font-medium text-green-700 dark:text-green-400">80-100:</span>
              <span className="text-green-600 dark:text-green-300 ml-2">Strong EOS implementation</span>
            </div>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
              <span className="font-medium text-yellow-700 dark:text-yellow-400">60-79:</span>
              <span className="text-yellow-600 dark:text-yellow-300 ml-2">Good progress, areas to improve</span>
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
              <span className="font-medium text-orange-700 dark:text-orange-400">40-59:</span>
              <span className="text-orange-600 dark:text-orange-300 ml-2">Early stages, focus needed</span>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <span className="font-medium text-red-700 dark:text-red-400">Below 40:</span>
              <span className="text-red-600 dark:text-red-300 ml-2">Significant work required</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
