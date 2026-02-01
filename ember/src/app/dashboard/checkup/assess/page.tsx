'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui'
import type { CheckupQuestion, CheckupResponse, EOSComponent } from '@/types/database'

const COMPONENT_LABELS: Record<EOSComponent, string> = {
  vision: 'Vision',
  people: 'People',
  data: 'Data',
  issues: 'Issues',
  process: 'Process',
  traction: 'Traction',
}

const COMPONENT_DESCRIPTIONS: Record<EOSComponent, string> = {
  vision: 'Do you have a clear, shared vision that everyone understands?',
  people: 'Do you have the right people in the right seats?',
  data: 'Do you have a pulse on your business through measurables?',
  issues: 'Do you identify and solve issues openly and honestly?',
  process: 'Are your core processes documented and followed?',
  traction: 'Do you have discipline and accountability to execute?',
}

const SCORE_LABELS = ['Weak', 'Below Avg', 'Average', 'Strong', 'Very Strong']

type ResponseMap = Record<string, { score: number; notes: string }>

export default function AssessPage() {
  const router = useRouter()
  const [periodId, setPeriodId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Record<EOSComponent, CheckupQuestion[]> | null>(null)
  const [responses, setResponses] = useState<ResponseMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedComponents, setExpandedComponents] = useState<Set<EOSComponent>>(new Set(['vision']))

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingChangesRef = useRef<ResponseMap>({})

  // Load active period and questions
  useEffect(() => {
    async function loadData() {
      try {
        // Get active period
        const periodRes = await fetch('/api/eos/checkup/periods?active=true')
        const period = await periodRes.json()

        if (!period || !period.id) {
          setError('No active assessment period. Please contact your admin.')
          setLoading(false)
          return
        }

        setPeriodId(period.id)

        // Get questions grouped by component
        const questionsRes = await fetch('/api/eos/checkup/questions?grouped=true')
        const questionsData = await questionsRes.json()
        setQuestions(questionsData)

        // Get existing responses
        const responsesRes = await fetch(`/api/eos/checkup/responses?periodId=${period.id}`)
        const responsesData: CheckupResponse[] = await responsesRes.json()

        // Convert to map
        const responseMap: ResponseMap = {}
        for (const r of responsesData) {
          responseMap[r.question_id] = { score: r.score, notes: r.notes || '' }
        }
        setResponses(responseMap)
      } catch (err) {
        console.error('Error loading checkup data:', err)
        setError('Failed to load assessment data.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Auto-save with debounce
  const saveResponses = useCallback(async () => {
    if (!periodId || Object.keys(pendingChangesRef.current).length === 0) return

    setSaving(true)
    try {
      const responsesToSave = Object.entries(pendingChangesRef.current).map(
        ([questionId, { score, notes }]) => ({
          question_id: questionId,
          score,
          notes: notes || undefined,
        })
      )

      await fetch('/api/eos/checkup/responses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodId, responses: responsesToSave }),
      })

      pendingChangesRef.current = {}
    } catch (err) {
      console.error('Error saving responses:', err)
    } finally {
      setSaving(false)
    }
  }, [periodId])

  // Debounced save
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(saveResponses, 1500)
  }, [saveResponses])

  // Handle score change
  const handleScoreChange = (questionId: string, score: number) => {
    const currentNotes = responses[questionId]?.notes || ''
    setResponses(prev => ({
      ...prev,
      [questionId]: { score, notes: currentNotes },
    }))
    pendingChangesRef.current[questionId] = { score, notes: currentNotes }
    debouncedSave()
  }

  // Handle notes change
  const handleNotesChange = (questionId: string, notes: string) => {
    const currentScore = responses[questionId]?.score
    if (currentScore === undefined) return // Don't save notes without a score

    setResponses(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], notes },
    }))
    pendingChangesRef.current[questionId] = { score: currentScore, notes }
    debouncedSave()
  }

  // Toggle component expansion
  const toggleComponent = (component: EOSComponent) => {
    setExpandedComponents(prev => {
      const next = new Set(prev)
      if (next.has(component)) {
        next.delete(component)
      } else {
        next.add(component)
      }
      return next
    })
  }

  // Submit assessment
  const handleSubmit = async () => {
    if (!periodId) return

    // Save any pending changes first
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    await saveResponses()

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/eos/checkup/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit assessment')
      }

      router.push(`/dashboard/checkup/${periodId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit assessment')
    } finally {
      setSubmitting(false)
    }
  }

  // Count answered questions
  const answeredCount = Object.keys(responses).length
  const totalCount = questions ? Object.values(questions).flat().length : 20
  const canSubmit = answeredCount === totalCount

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading assessment...</div>
      </div>
    )
  }

  if (error && !questions) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Link
              href="/dashboard/checkup"
              className="mt-4 inline-block text-ember-600 hover:text-ember-700 dark:text-ember-400"
            >
              Back to Checkup
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const components: EOSComponent[] = ['vision', 'people', 'data', 'issues', 'process', 'traction']

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Take Assessment</h1>
          <p className="text-muted-foreground mt-1">
            Rate each statement from 1 (Weak) to 5 (Very Strong)
          </p>
        </div>
        <div className="flex items-center gap-4">
          {saving && (
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Saving...
            </span>
          )}
          <Link
            href="/dashboard/checkup"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-muted-foreground">
              {answeredCount}/{totalCount} answered
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-ember-500 rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / totalCount) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Questions by Component */}
      {questions && components.map(component => {
        const componentQuestions = questions[component] || []
        const isExpanded = expandedComponents.has(component)
        const answeredInComponent = componentQuestions.filter(
          q => responses[q.id] !== undefined
        ).length

        return (
          <Card key={component}>
            <button
              type="button"
              className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
              onClick={() => toggleComponent(component)}
            >
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {COMPONENT_LABELS[component]}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {COMPONENT_DESCRIPTIONS[component]}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {answeredInComponent}/{componentQuestions.length}
                </span>
                <svg
                  className={`w-5 h-5 text-muted-foreground transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </button>

            {isExpanded && (
              <CardContent className="pt-0 pb-4 px-4 space-y-6">
                {componentQuestions.map((question, idx) => (
                  <div key={question.id} className="border-t border-border pt-4 first:border-0 first:pt-0">
                    <p className="text-sm text-foreground mb-3">
                      <span className="text-muted-foreground mr-2">
                        {question.question_order}.
                      </span>
                      {question.question_text}
                    </p>

                    {/* Score buttons */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {[1, 2, 3, 4, 5].map(score => {
                        const isSelected = responses[question.id]?.score === score
                        return (
                          <button
                            key={score}
                            type="button"
                            onClick={() => handleScoreChange(question.id, score)}
                            className={`
                              flex flex-col items-center px-3 py-2 rounded-lg border transition-colors
                              ${isSelected
                                ? 'border-ember-500 bg-ember-50 dark:bg-ember-950/30'
                                : 'border-border hover:border-ember-300 hover:bg-muted/50'
                              }
                            `}
                          >
                            <span className={`text-lg font-semibold ${
                              isSelected ? 'text-ember-600 dark:text-ember-400' : 'text-foreground'
                            }`}>
                              {score}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {SCORE_LABELS[score - 1]}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    {/* Optional notes */}
                    {responses[question.id] !== undefined && (
                      <textarea
                        placeholder="Add notes (optional)"
                        value={responses[question.id]?.notes || ''}
                        onChange={(e) => handleNotesChange(question.id, e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ember-500"
                        rows={2}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        )
      })}

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Submit button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {canSubmit
            ? 'All questions answered. Ready to submit!'
            : `Please answer all ${totalCount} questions before submitting.`}
        </p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className={`
            px-6 py-2.5 rounded-lg font-medium transition-colors
            ${canSubmit
              ? 'bg-ember-500 text-white hover:bg-ember-600'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
            }
          `}
        >
          {submitting ? 'Submitting...' : 'Submit Assessment'}
        </button>
      </div>
    </div>
  )
}
