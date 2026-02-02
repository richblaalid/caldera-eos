import { createClient } from '@/lib/supabase/server'
import type {
  RockWithOwner,
  IssueWithOwner,
  TodoWithOwner,
  Transcript,
  Meeting,
  SearchEntityType,
  SearchResults,
} from '@/types/database'

// Re-export types for convenience
export type { SearchEntityType, SearchResults }

export interface SearchOptions {
  types?: SearchEntityType[]
  limit?: number
}

const DEFAULT_LIMIT = 5
const ALL_TYPES: SearchEntityType[] = ['rocks', 'issues', 'todos', 'transcripts', 'meetings']

// =============================================
// Search Functions
// =============================================

export async function globalSearch(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResults> {
  const supabase = await createClient()
  const types = options.types ?? ALL_TYPES
  const limit = options.limit ?? DEFAULT_LIMIT

  // Prepare search pattern for ILIKE
  const pattern = `%${query}%`

  // Initialize empty results
  const results: SearchResults = {
    rocks: [],
    issues: [],
    todos: [],
    transcripts: [],
    meetings: [],
  }

  // Run searches in parallel for types that are requested
  const searches: Promise<void>[] = []

  if (types.includes('rocks')) {
    searches.push(
      searchRocks(supabase, pattern, limit).then((data) => {
        results.rocks = data
      })
    )
  }

  if (types.includes('issues')) {
    searches.push(
      searchIssues(supabase, pattern, limit).then((data) => {
        results.issues = data
      })
    )
  }

  if (types.includes('todos')) {
    searches.push(
      searchTodos(supabase, pattern, limit).then((data) => {
        results.todos = data
      })
    )
  }

  if (types.includes('transcripts')) {
    searches.push(
      searchTranscripts(supabase, pattern, limit).then((data) => {
        results.transcripts = data
      })
    )
  }

  if (types.includes('meetings')) {
    searches.push(
      searchMeetings(supabase, pattern, limit).then((data) => {
        results.meetings = data
      })
    )
  }

  await Promise.all(searches)

  return results
}

// =============================================
// Individual Entity Search Functions
// =============================================

async function searchRocks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pattern: string,
  limit: number
): Promise<RockWithOwner[]> {
  const { data, error } = await supabase
    .from('rocks')
    .select('*, owner:profiles(*)')
    .or(`title.ilike.${pattern},description.ilike.${pattern},notes.ilike.${pattern}`)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error searching rocks:', error)
    return []
  }

  return data as RockWithOwner[]
}

async function searchIssues(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pattern: string,
  limit: number
): Promise<IssueWithOwner[]> {
  const { data, error } = await supabase
    .from('issues')
    .select('*, owner:profiles(*)')
    .or(`title.ilike.${pattern},description.ilike.${pattern},resolution.ilike.${pattern}`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error searching issues:', error)
    return []
  }

  return data as IssueWithOwner[]
}

async function searchTodos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pattern: string,
  limit: number
): Promise<TodoWithOwner[]> {
  const { data, error } = await supabase
    .from('todos')
    .select('*, owner:profiles(*)')
    .or(`title.ilike.${pattern},description.ilike.${pattern}`)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error searching todos:', error)
    return []
  }

  return data as TodoWithOwner[]
}

async function searchTranscripts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pattern: string,
  limit: number
): Promise<Transcript[]> {
  const { data, error } = await supabase
    .from('transcripts')
    .select('*')
    .or(`title.ilike.${pattern},summary.ilike.${pattern}`)
    .order('meeting_date', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    console.error('Error searching transcripts:', error)
    return []
  }

  return data as Transcript[]
}

async function searchMeetings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pattern: string,
  limit: number
): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .or(`title.ilike.${pattern},notes.ilike.${pattern}`)
    .order('meeting_date', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error searching meetings:', error)
    return []
  }

  return data as Meeting[]
}

// =============================================
// Helper Functions
// =============================================

export function hasResults(results: SearchResults): boolean {
  return (
    results.rocks.length > 0 ||
    results.issues.length > 0 ||
    results.todos.length > 0 ||
    results.transcripts.length > 0 ||
    results.meetings.length > 0
  )
}

export function totalResultCount(results: SearchResults): number {
  return (
    results.rocks.length +
    results.issues.length +
    results.todos.length +
    results.transcripts.length +
    results.meetings.length
  )
}
