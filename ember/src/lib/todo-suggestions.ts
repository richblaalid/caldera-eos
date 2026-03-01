import { createInsight, createInsightAdmin } from './eos'
import { isSimilarTitle } from './suggestion-utils'
import type { InsightInsert } from '@/types/database'
import type { ExtractedItem } from './transcripts'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * Get existing open todo titles for dedup comparison.
 * Uses admin client when organizationId is provided (for seed/cron routes).
 */
async function getExistingTodoTitles(organizationId?: string): Promise<string[]> {
  if (organizationId) {
    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await supabase
      .from('todos')
      .select('title')
      .eq('organization_id', organizationId)
      .eq('completed', false)
    return (data || []).map(t => t.title.toLowerCase())
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('todos')
    .select('title')
    .eq('completed', false)
  return (data || []).map(t => t.title.toLowerCase())
}

/**
 * Get existing pending todo suggestion titles to avoid duplicates.
 */
async function getPendingSuggestionTitles(organizationId?: string): Promise<string[]> {
  if (organizationId) {
    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await supabase
      .from('insights')
      .select('title')
      .eq('type', 'suggestion')
      .like('title', 'Suggested Todo:%')
      .eq('acknowledged', false)
    return (data || []).map(i => i.title.replace('Suggested Todo: ', '').toLowerCase())
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('insights')
    .select('title')
    .eq('type', 'suggestion')
    .like('title', 'Suggested Todo:%')
    .eq('acknowledged', false)
  return (data || []).map(i => i.title.replace('Suggested Todo: ', '').toLowerCase())
}

/**
 * Generate insight suggestions for new todos extracted from a transcript.
 * Returns array of created insight IDs.
 *
 * @param organizationId - When provided, uses admin client (for seed/cron routes)
 */
export async function generateTodoSuggestions(
  todos: ExtractedItem[],
  transcriptId: string,
  transcriptTitle: string,
  organizationId?: string
): Promise<string[]> {
  if (!todos || todos.length === 0) return []

  const [existingTitles, pendingTitles] = await Promise.all([
    getExistingTodoTitles(organizationId),
    getPendingSuggestionTitles(organizationId),
  ])

  const allExisting = [...existingTitles, ...pendingTitles]
  const newTodos = todos.filter(t => !isSimilarTitle(t.title, allExisting))

  if (newTodos.length === 0) return []

  const createdIds: string[] = []

  for (const todo of newTodos) {
    const todoData = JSON.stringify({
      title: todo.title,
      description: todo.description,
      owner: todo.owner,
      due_date: todo.due_date,
      priority: todo.priority,
      confidence: todo.confidence,
      context: todo.context,
    })

    // Map confidence to insight priority for DB-level sorting
    const mappedPriority = (todo.confidence ?? 0) >= 0.9 ? 1
      : (todo.confidence ?? 0) >= 0.7 ? 2 : 3

    const insight: InsightInsert = {
      type: 'suggestion',
      title: `Suggested Todo: ${todo.title}`,
      content: todoData,
      priority: todo.priority || mappedPriority,
      sources: [{ type: 'transcript', id: transcriptId, title: transcriptTitle }],
      related_entities: {},
    }

    const created = organizationId
      ? await createInsightAdmin(insight, organizationId)
      : await createInsight(insight)

    if (created) {
      createdIds.push(created.id)
      console.log(`Created todo suggestion: ${todo.title}`)
    }
  }

  return createdIds
}
