import { createClient } from '@/lib/supabase/server'
import type {
  Rock,
  RockWithOwner,
  RockInsert,
  Issue,
  IssueWithOwner,
  IssueInsert,
  Todo,
  TodoWithOwner,
  TodoInsert,
  VTO,
  VTOInsert,
  ScorecardMetric,
  ScorecardEntry,
  ScorecardEntryInsert,
  Meeting,
  Insight,
  InsightInsert,
  Profile,
} from '@/types/database'

// =============================================
// V/TO Operations
// =============================================

export async function getVTO() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vto')
    .select('*')
    .order('version', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as VTO | null
}

export async function upsertVTO(vto: VTOInsert) {
  const supabase = await createClient()
  const existing = await getVTO()

  if (existing) {
    const { data, error } = await supabase
      .from('vto')
      .update({ ...vto, version: existing.version + 1 })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data as VTO
  } else {
    const { data, error } = await supabase
      .from('vto')
      .insert(vto)
      .select()
      .single()
    if (error) throw error
    return data as VTO
  }
}

// =============================================
// Rocks Operations
// =============================================

export async function getRocks(quarter?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('rocks')
    .select('*, owner:profiles(*)')
    .order('created_at', { ascending: false })

  if (quarter) {
    query = query.eq('quarter', quarter)
  }

  const { data, error } = await query
  if (error) throw error
  return data as RockWithOwner[]
}

export async function getRock(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('rocks')
    .select('*, owner:profiles(*)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as RockWithOwner
}

export async function createRock(rock: RockInsert) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('rocks')
    .insert(rock)
    .select()
    .single()

  if (error) throw error
  return data as Rock
}

export async function updateRock(id: string, updates: Partial<RockInsert>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('rocks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Rock
}

export async function deleteRock(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('rocks').delete().eq('id', id)
  if (error) throw error
}

// =============================================
// Issues Operations
// =============================================

export async function getIssues(status?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('issues')
    .select('*, owner:profiles(*)')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error
  return data as IssueWithOwner[]
}

export async function getIssue(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('issues')
    .select('*, owner:profiles(*)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as IssueWithOwner
}

export async function createIssue(issue: IssueInsert) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('issues')
    .insert(issue)
    .select()
    .single()

  if (error) throw error
  return data as Issue
}

export async function updateIssue(id: string, updates: Partial<IssueInsert>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('issues')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Issue
}

export async function deleteIssue(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('issues').delete().eq('id', id)
  if (error) throw error
}

// =============================================
// Todos Operations
// =============================================

export async function getTodos(filters?: { owner_id?: string; completed?: boolean }) {
  const supabase = await createClient()
  let query = supabase
    .from('todos')
    .select('*, owner:profiles(*)')
    .order('due_date', { ascending: true })
    .order('created_at', { ascending: false })

  if (filters?.owner_id) {
    query = query.eq('owner_id', filters.owner_id)
  }
  if (filters?.completed !== undefined) {
    query = query.eq('completed', filters.completed)
  }

  const { data, error } = await query
  if (error) throw error
  return data as TodoWithOwner[]
}

export async function getTodo(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('todos')
    .select('*, owner:profiles(*)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as TodoWithOwner
}

export async function createTodo(todo: TodoInsert) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('todos')
    .insert(todo)
    .select()
    .single()

  if (error) throw error
  return data as Todo
}

export async function updateTodo(id: string, updates: Partial<TodoInsert>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('todos')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Todo
}

export async function toggleTodo(id: string) {
  const supabase = await createClient()
  const todo = await getTodo(id)

  const updates: Partial<TodoInsert> = {
    completed: !todo.completed,
    completed_at: todo.completed ? null : new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('todos')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Todo
}

export async function deleteTodo(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('todos').delete().eq('id', id)
  if (error) throw error
}

// =============================================
// Scorecard Operations
// =============================================

export async function getMetrics() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('scorecard_metrics')
    .select('*, owner:profiles(*)')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) throw error
  return data as (ScorecardMetric & { owner: Profile | null })[]
}

export async function getMetricEntries(metricId: string, weeks?: number) {
  const supabase = await createClient()
  let query = supabase
    .from('scorecard_entries')
    .select('*')
    .eq('metric_id', metricId)
    .order('week_of', { ascending: false })

  if (weeks) {
    query = query.limit(weeks)
  }

  const { data, error } = await query
  if (error) throw error
  return data as ScorecardEntry[]
}

export async function upsertMetricEntry(entry: ScorecardEntryInsert) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('scorecard_entries')
    .upsert(entry, { onConflict: 'metric_id,week_of' })
    .select()
    .single()

  if (error) throw error
  return data as ScorecardEntry
}

// =============================================
// Meetings Operations
// =============================================

export async function getMeetings(type?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('meetings')
    .select('*')
    .order('meeting_date', { ascending: false })

  if (type) {
    query = query.eq('meeting_type', type)
  }

  const { data, error } = await query
  if (error) throw error
  return data as Meeting[]
}

export async function getUpcomingMeeting() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .gte('meeting_date', new Date().toISOString())
    .order('meeting_date', { ascending: true })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as Meeting | null
}

// =============================================
// Insights Operations
// =============================================

export async function getActiveInsights() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('insights')
    .select('*')
    .eq('acknowledged', false)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Insight[]
}

export async function acknowledgeInsight(id: string, userId: string) {
  const supabase = await createClient()
  const updates: Partial<InsightInsert> = {
    acknowledged: true,
    acknowledged_at: new Date().toISOString(),
    acknowledged_by: userId,
  }
  const { data, error } = await supabase
    .from('insights')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Insight
}

// =============================================
// Profiles Operations
// =============================================

export async function getProfiles() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw error
  return data as Profile[]
}

export async function getProfile(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Profile
}

// =============================================
// Utility: Get Current Quarter
// =============================================

export function getCurrentQuarter(): string {
  const now = new Date()
  const quarter = Math.ceil((now.getMonth() + 1) / 3)
  return `Q${quarter} ${now.getFullYear()}`
}
