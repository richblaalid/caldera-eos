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
  ScorecardMetricInsert,
  ScorecardEntry,
  ScorecardEntryInsert,
  Meeting,
  MeetingInsert,
  Insight,
  InsightInsert,
  Profile,
  Transcript,
  TranscriptInsert,
  TranscriptChunk,
  TranscriptChunkInsert,
} from '@/types/database'

// =============================================
// V/TO Operations
// =============================================

// Helper to get user's organization ID
async function getUserOrganizationId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .limit(1)
    .single()

  if (membership?.organization_id) {
    return membership.organization_id
  }

  // Check allowed_emails and auto-assign
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null

  const { data: allowed } = await supabase
    .from('allowed_emails')
    .select('organization_id')
    .eq('email', user.email)
    .eq('auto_assign', true)
    .single()

  if (allowed?.organization_id) {
    // Auto-assign user to organization
    await supabase
      .from('organization_members')
      .insert({
        organization_id: allowed.organization_id,
        user_id: user.id,
        role: 'member',
      })
      .select()
      .single()

    return allowed.organization_id
  }

  return null
}

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
    // Get user's organization for new VTO
    const orgId = await getUserOrganizationId(supabase)
    const { data, error } = await supabase
      .from('vto')
      .insert({
        ...vto,
        ...(orgId && { organization_id: orgId }),
      })
      .select()
      .single()
    if (error) throw error
    return data as VTO
  }
}

// Create a default empty V/TO structure
export function createEmptyVTO(): VTOInsert {
  return {
    core_values: [],
    core_focus: {
      purpose: '',
      niche: '',
    },
    ten_year_target: {
      goal: '',
      target_date: '',
    },
    marketing_strategy: {
      target_market: {},
      three_uniques: [],
    },
    three_year_picture: {
      target_date: '',
      measurables: [],
      what_does_it_look_like: [],
    },
    one_year_plan: {
      target_date: '',
      measurables: [],
      goals: [],
    },
    quarterly_rocks: [],
    issues_list: [],
    accountability_chart: [],
  }
}

// Get or create the V/TO (returns existing or creates empty)
export async function getOrCreateVTO(): Promise<VTO> {
  const existing = await getVTO()
  if (existing) return existing
  return await upsertVTO(createEmptyVTO())
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

  // Get user's organization ID for RLS compliance
  const orgId = await getUserOrganizationId(supabase)
  if (!orgId) {
    throw new Error('User is not a member of any organization')
  }

  const { data, error } = await supabase
    .from('rocks')
    .insert({ ...rock, organization_id: orgId })
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

  // Get user's organization ID for RLS compliance
  const orgId = await getUserOrganizationId(supabase)
  if (!orgId) {
    throw new Error('User is not a member of any organization')
  }

  const { data, error } = await supabase
    .from('issues')
    .insert({ ...issue, organization_id: orgId })
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

  // Get user's organization ID for RLS compliance
  const orgId = await getUserOrganizationId(supabase)
  if (!orgId) {
    throw new Error('User is not a member of any organization')
  }

  const { data, error } = await supabase
    .from('todos')
    .insert({ ...todo, organization_id: orgId })
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

export async function getExistingMetricNames(): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('scorecard_metrics')
    .select('name')
    .eq('is_active', true)
  return (data || []).map((m) => m.name.toLowerCase())
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

export async function getMetric(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('scorecard_metrics')
    .select('*, owner:profiles(*)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as ScorecardMetric & { owner: Profile | null }
}

export async function createMetric(metric: ScorecardMetricInsert) {
  const supabase = await createClient()

  // Get current max display_order
  const { data: existing } = await supabase
    .from('scorecard_metrics')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)

  const maxOrder = existing?.[0]?.display_order ?? 0

  const { data, error } = await supabase
    .from('scorecard_metrics')
    .insert({
      ...metric,
      display_order: metric.display_order ?? maxOrder + 1,
    })
    .select()
    .single()

  if (error) throw error
  return data as ScorecardMetric
}

export async function updateMetric(id: string, updates: Partial<ScorecardMetricInsert>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('scorecard_metrics')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ScorecardMetric
}

export async function deleteMetric(id: string) {
  const supabase = await createClient()
  // Soft delete by setting is_active to false
  const { error } = await supabase
    .from('scorecard_metrics')
    .update({ is_active: false })
    .eq('id', id)

  if (error) throw error
}

export async function getAllMetricEntries(weekStart: string, weekEnd: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('scorecard_entries')
    .select('*')
    .gte('week_of', weekStart)
    .lte('week_of', weekEnd)
    .order('week_of', { ascending: false })

  if (error) throw error
  return data as ScorecardEntry[]
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

export async function getMeeting(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Meeting
}

export async function createMeeting(meeting: MeetingInsert) {
  const supabase = await createClient()
  const orgId = await getUserOrganizationId(supabase)

  const { data, error } = await supabase
    .from('meetings')
    .insert({ ...meeting, organization_id: orgId })
    .select()
    .single()

  if (error) throw error
  return data as Meeting
}

export async function updateMeeting(id: string, updates: Partial<MeetingInsert>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('meetings')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Meeting
}

export async function deleteMeeting(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('meetings').delete().eq('id', id)
  if (error) throw error
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

export async function createInsight(insight: InsightInsert): Promise<Insight | null> {
  const supabase = await createClient()
  const orgId = await getUserOrganizationId(supabase)
  if (!orgId) return null

  const { data, error } = await supabase
    .from('insights')
    .insert({ ...insight, organization_id: orgId })
    .select()
    .single()

  if (error) {
    console.error('Error creating insight:', error)
    return null
  }
  return data as Insight
}

// =============================================
// Profiles Operations
// =============================================

export async function getProfiles() {
  const supabase = await createClient()

  // Get the current user's organization
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return []

  // Get all user IDs in the organization
  const { data: orgMembers, error: membersError } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', membership.organization_id)

  if (membersError) throw membersError
  if (!orgMembers || orgMembers.length === 0) return []

  // Get profiles for those users
  const userIds = orgMembers.map(m => m.user_id)
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', userIds)
    .order('name', { ascending: true })

  if (profilesError) throw profilesError

  return (profiles || []) as Profile[]
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
// Transcripts Operations
// =============================================

export async function getTranscripts(filters?: { meeting_id?: string; processed?: boolean }) {
  const supabase = await createClient()
  let query = supabase
    .from('transcripts')
    .select('*')
    .order('meeting_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters?.meeting_id) {
    query = query.eq('meeting_id', filters.meeting_id)
  }
  if (filters?.processed !== undefined) {
    query = query.eq('processed', filters.processed)
  }

  const { data, error } = await query
  if (error) throw error
  return data as Transcript[]
}

export async function getTranscript(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('transcripts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Transcript
}

export async function createTranscript(transcript: TranscriptInsert) {
  const supabase = await createClient()
  const orgId = await getUserOrganizationId(supabase)

  const { data, error } = await supabase
    .from('transcripts')
    .insert({ ...transcript, organization_id: orgId })
    .select()
    .single()

  if (error) throw error
  return data as Transcript
}

export async function updateTranscript(id: string, updates: Partial<TranscriptInsert>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('transcripts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Transcript
}

export async function deleteTranscript(id: string) {
  const supabase = await createClient()
  // Delete chunks first due to foreign key
  await supabase.from('transcript_chunks').delete().eq('transcript_id', id)
  const { error } = await supabase.from('transcripts').delete().eq('id', id)
  if (error) throw error
}

// =============================================
// Transcript Chunks Operations
// =============================================

export async function getTranscriptChunks(transcriptId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('transcript_chunks')
    .select('*')
    .eq('transcript_id', transcriptId)
    .order('chunk_index', { ascending: true })

  if (error) throw error
  return data as TranscriptChunk[]
}

export async function createTranscriptChunks(chunks: TranscriptChunkInsert[]) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('transcript_chunks')
    .insert(chunks)
    .select()

  if (error) throw error
  return data as TranscriptChunk[]
}

export async function updateChunkEmbedding(chunkId: string, embedding: number[]) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('transcript_chunks')
    .update({ embedding })
    .eq('id', chunkId)
    .select()
    .single()

  if (error) throw error
  return data as TranscriptChunk
}

// =============================================
// Utility: Get Current Quarter
// =============================================

export function getCurrentQuarter(): string {
  const now = new Date()
  const quarter = Math.ceil((now.getMonth() + 1) / 3)
  return `Q${quarter} ${now.getFullYear()}`
}
