import { createClient } from '@/lib/supabase/server'
import type {
  CheckupPeriod,
  CheckupPeriodInsert,
  CheckupQuestion,
  CheckupResponse,
  CheckupResponseInsert,
  CheckupCompletion,
  CheckupCompletionInsert,
  ComponentScores,
  EOSComponent,
  Profile,
} from '@/types/database'

// =============================================
// Checkup Periods
// =============================================

export async function getCheckupPeriods() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checkup_periods')
    .select('*')
    .order('start_date', { ascending: false })

  if (error) throw error
  return data as CheckupPeriod[]
}

export async function getActivePeriod() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checkup_periods')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as CheckupPeriod | null
}

export async function getCheckupPeriod(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checkup_periods')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as CheckupPeriod
}

export async function createCheckupPeriod(period: CheckupPeriodInsert) {
  const supabase = await createClient()

  // If this period is active, deactivate others first
  if (period.is_active) {
    await supabase
      .from('checkup_periods')
      .update({ is_active: false })
      .eq('organization_id', period.organization_id)
  }

  const { data, error } = await supabase
    .from('checkup_periods')
    .insert(period)
    .select()
    .single()

  if (error) throw error
  return data as CheckupPeriod
}

export async function updateCheckupPeriod(id: string, updates: Partial<CheckupPeriodInsert>) {
  const supabase = await createClient()

  // If activating this period, deactivate others first
  if (updates.is_active) {
    const period = await getCheckupPeriod(id)
    await supabase
      .from('checkup_periods')
      .update({ is_active: false })
      .eq('organization_id', period.organization_id)
      .neq('id', id)
  }

  const { data, error } = await supabase
    .from('checkup_periods')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as CheckupPeriod
}

export async function deleteCheckupPeriod(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('checkup_periods').delete().eq('id', id)
  if (error) throw error
}

// =============================================
// Checkup Questions (Read-only)
// =============================================

export async function getCheckupQuestions() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checkup_questions')
    .select('*')
    .order('question_order', { ascending: true })

  if (error) throw error
  return data as CheckupQuestion[]
}

export async function getQuestionsByComponent() {
  const questions = await getCheckupQuestions()
  const grouped: Record<EOSComponent, CheckupQuestion[]> = {
    vision: [],
    people: [],
    data: [],
    issues: [],
    process: [],
    traction: [],
  }

  for (const q of questions) {
    grouped[q.component].push(q)
  }

  return grouped
}

// =============================================
// Checkup Responses
// =============================================

export async function getUserResponses(periodId: string, userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checkup_responses')
    .select('*')
    .eq('period_id', periodId)
    .eq('user_id', userId)

  if (error) throw error
  return data as CheckupResponse[]
}

export async function upsertResponse(response: CheckupResponseInsert) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checkup_responses')
    .upsert(response, {
      onConflict: 'period_id,user_id,question_id',
    })
    .select()
    .single()

  if (error) throw error
  return data as CheckupResponse
}

export async function upsertResponses(responses: CheckupResponseInsert[]) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checkup_responses')
    .upsert(responses, {
      onConflict: 'period_id,user_id,question_id',
    })
    .select()

  if (error) throw error
  return data as CheckupResponse[]
}

// =============================================
// Checkup Completions
// =============================================

export async function getCompletion(periodId: string, userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checkup_completions')
    .select('*')
    .eq('period_id', periodId)
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as CheckupCompletion | null
}

export async function getPeriodCompletions(periodId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checkup_completions')
    .select('*')
    .eq('period_id', periodId)

  if (error) throw error
  return data as CheckupCompletion[]
}

export async function createCompletion(completion: CheckupCompletionInsert) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checkup_completions')
    .upsert(completion, {
      onConflict: 'period_id,user_id',
    })
    .select()
    .single()

  if (error) throw error
  return data as CheckupCompletion
}

// =============================================
// Score Calculation
// =============================================

const COMPONENT_MAX_SCORES: Record<EOSComponent, number> = {
  vision: 15,   // 3 questions * 5
  people: 20,   // 4 questions * 5
  data: 15,     // 3 questions * 5
  issues: 15,   // 3 questions * 5
  process: 15,  // 3 questions * 5
  traction: 20, // 4 questions * 5
}

export function calculateComponentScores(
  responses: CheckupResponse[],
  questions: CheckupQuestion[]
): ComponentScores {
  const questionMap = new Map(questions.map(q => [q.id, q]))

  const scores: Record<EOSComponent, number> = {
    vision: 0,
    people: 0,
    data: 0,
    issues: 0,
    process: 0,
    traction: 0,
  }

  for (const response of responses) {
    const question = questionMap.get(response.question_id)
    if (question) {
      scores[question.component] += response.score
    }
  }

  return {
    vision: { score: scores.vision, max: COMPONENT_MAX_SCORES.vision },
    people: { score: scores.people, max: COMPONENT_MAX_SCORES.people },
    data: { score: scores.data, max: COMPONENT_MAX_SCORES.data },
    issues: { score: scores.issues, max: COMPONENT_MAX_SCORES.issues },
    process: { score: scores.process, max: COMPONENT_MAX_SCORES.process },
    traction: { score: scores.traction, max: COMPONENT_MAX_SCORES.traction },
    total: {
      score: Object.values(scores).reduce((a, b) => a + b, 0),
      max: 100,
    },
  }
}

export async function submitCheckup(periodId: string, userId: string) {
  const [responses, questions] = await Promise.all([
    getUserResponses(periodId, userId),
    getCheckupQuestions(),
  ])

  // Verify all questions are answered
  const totalQuestions = questions.length
  if (responses.length !== totalQuestions) {
    // Find which questions are missing
    const answeredIds = new Set(responses.map(r => r.question_id))
    const unanswered = questions.filter(q => !answeredIds.has(q.id))
    const unansweredList = unanswered.map(q => `#${q.question_order}`).join(', ')
    throw new Error(
      `Please answer all ${totalQuestions} questions. Currently answered: ${responses.length}. ` +
      `Missing: ${unansweredList || 'unknown'}`
    )
  }

  const scores = calculateComponentScores(responses, questions)

  const completion: CheckupCompletionInsert = {
    period_id: periodId,
    user_id: userId,
    total_score: scores.total.score,
    vision_score: scores.vision.score,
    people_score: scores.people.score,
    data_score: scores.data.score,
    issues_score: scores.issues.score,
    process_score: scores.process.score,
    traction_score: scores.traction.score,
  }

  return createCompletion(completion)
}

// =============================================
// Statistics
// =============================================

export interface PeriodStats {
  period: CheckupPeriod
  totalMembers: number
  completedCount: number
  pendingMembers: Profile[]
  teamAverages: ComponentScores | null
  completions: (CheckupCompletion & { user: Profile })[]
}

export async function getPeriodStats(periodId: string): Promise<PeriodStats> {
  const supabase = await createClient()

  // Get period
  const period = await getCheckupPeriod(periodId)

  // Get org members
  const { data: members } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', period.organization_id)

  const memberIds = members?.map(m => m.user_id) || []

  // Get completions with user info
  const { data: completions } = await supabase
    .from('checkup_completions')
    .select('*')
    .eq('period_id', periodId)

  const completedIds = new Set(completions?.map(c => c.user_id) || [])

  // Get profiles for all members
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .in('id', memberIds)

  const profileMap = new Map((profiles || []).map(p => [p.id, p as Profile]))

  // Build pending members list
  const pendingMembers = memberIds
    .filter(id => !completedIds.has(id))
    .map(id => profileMap.get(id))
    .filter((p): p is Profile => p !== undefined)

  // Build completions with user
  const completionsWithUser = (completions || []).map(c => ({
    ...c,
    user: profileMap.get(c.user_id)!,
  })) as (CheckupCompletion & { user: Profile })[]

  // Calculate team averages if any completions exist
  let teamAverages: ComponentScores | null = null
  if (completions && completions.length > 0) {
    const count = completions.length
    teamAverages = {
      vision: {
        score: Math.round(completions.reduce((sum, c) => sum + c.vision_score, 0) / count),
        max: COMPONENT_MAX_SCORES.vision,
      },
      people: {
        score: Math.round(completions.reduce((sum, c) => sum + c.people_score, 0) / count),
        max: COMPONENT_MAX_SCORES.people,
      },
      data: {
        score: Math.round(completions.reduce((sum, c) => sum + c.data_score, 0) / count),
        max: COMPONENT_MAX_SCORES.data,
      },
      issues: {
        score: Math.round(completions.reduce((sum, c) => sum + c.issues_score, 0) / count),
        max: COMPONENT_MAX_SCORES.issues,
      },
      process: {
        score: Math.round(completions.reduce((sum, c) => sum + c.process_score, 0) / count),
        max: COMPONENT_MAX_SCORES.process,
      },
      traction: {
        score: Math.round(completions.reduce((sum, c) => sum + c.traction_score, 0) / count),
        max: COMPONENT_MAX_SCORES.traction,
      },
      total: {
        score: Math.round(completions.reduce((sum, c) => sum + c.total_score, 0) / count),
        max: 100,
      },
    }
  }

  return {
    period,
    totalMembers: memberIds.length,
    completedCount: completedIds.size,
    pendingMembers,
    teamAverages,
    completions: completionsWithUser,
  }
}

export async function getHistoricalScores() {
  const supabase = await createClient()

  // Get all periods with completions
  const { data: periods } = await supabase
    .from('checkup_periods')
    .select('*')
    .order('start_date', { ascending: true })

  if (!periods || periods.length === 0) return []

  // Get all completions
  const { data: completions } = await supabase
    .from('checkup_completions')
    .select('*')

  if (!completions) return []

  // Group completions by period and calculate averages
  return periods.map(period => {
    const periodCompletions = completions.filter(c => c.period_id === period.id)
    const count = periodCompletions.length

    if (count === 0) {
      return {
        period,
        averageScore: null,
        completionCount: 0,
      }
    }

    return {
      period,
      averageScore: Math.round(
        periodCompletions.reduce((sum, c) => sum + c.total_score, 0) / count
      ),
      completionCount: count,
    }
  })
}

// =============================================
// Get User's Organization ID (helper)
// =============================================

export async function getUserOrganizationId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .limit(1)
    .single()

  return membership?.organization_id || null
}
