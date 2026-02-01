/**
 * Context Retrieval for Ember Chat
 * Fetches relevant EOS data and transcript context for AI responses
 */

import { createClient } from '@/lib/supabase/server'
import { formatEOSContext } from '@/lib/ember'

export interface ChatContext {
  eosData: string
  transcriptContext: string
  sources: string[]
}

/**
 * Retrieve relevant context for a chat query
 */
export async function retrieveContext(query: string): Promise<ChatContext> {
  const supabase = await createClient()
  const sources: string[] = []

  // Fetch current EOS data
  const [rocksRes, issuesRes, todosRes, metricsRes] = await Promise.all([
    supabase
      .from('rocks')
      .select('title, status, owner:profiles!rocks_owner_id_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('issues')
      .select('title, status, priority, owner:profiles!issues_owner_id_fkey(name)')
      .in('status', ['open', 'identified', 'discussed'])
      .order('priority', { ascending: true })
      .limit(10),
    supabase
      .from('todos')
      .select('title, completed, due_date, owner:profiles!todos_owner_id_fkey(name)')
      .eq('completed', false)
      .order('due_date', { ascending: true })
      .limit(10),
    supabase
      .from('scorecard_metrics')
      .select(`
        name,
        target,
        goal_direction,
        entries:scorecard_entries(value, week_of)
      `)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(10),
  ])

  // Format EOS data
  // Note: Supabase relation typing - cast to unknown first then to expected type
  const rocks = rocksRes.data?.map((r) => {
    const owner = r.owner as unknown as { name: string } | null
    return {
      title: r.title,
      status: r.status,
      owner_name: owner?.name || null,
    }
  }) || []

  const issues = issuesRes.data?.map((i) => ({
    title: i.title,
    status: i.status,
    priority: i.priority,
  })) || []

  const todos = todosRes.data?.map((t) => {
    const owner = t.owner as unknown as { name: string } | null
    return {
      title: t.title,
      completed: t.completed,
      due_date: t.due_date,
      owner_name: owner?.name || null,
    }
  }) || []

  const metrics = metricsRes.data?.map((m) => {
    const entries = m.entries as Array<{ value: number; week_of: string }> | null
    const latestEntry = entries?.sort((a, b) =>
      new Date(b.week_of).getTime() - new Date(a.week_of).getTime()
    )[0]
    return {
      name: m.name,
      target: m.target,
      latest_value: latestEntry?.value || null,
    }
  }) || []

  const eosData = formatEOSContext({ rocks, issues, todos, metrics })

  if (rocks.length > 0) sources.push('rocks')
  if (issues.length > 0) sources.push('issues')
  if (todos.length > 0) sources.push('todos')
  if (metrics.length > 0) sources.push('scorecard')

  // Search transcripts for relevant context
  let transcriptContext = ''

  // Extract key terms from query for text search
  const searchTerms = extractSearchTerms(query)

  if (searchTerms.length > 0) {
    // Search transcript chunks for relevant content
    const { data: chunks } = await supabase
      .from('transcript_chunks')
      .select('content, transcript:transcripts!transcript_chunks_transcript_id_fkey(title)')
      .textSearch('content', searchTerms.join(' | '), { type: 'websearch' })
      .limit(5)

    if (chunks && chunks.length > 0) {
      transcriptContext = `## Relevant Meeting Context\n${chunks
        .map((c) => {
          const transcript = c.transcript as unknown as { title: string } | null
          const transcriptTitle = transcript?.title || 'Meeting'
          return `### From "${transcriptTitle}":\n${c.content}`
        })
        .join('\n\n')}`
      sources.push('transcripts')
    }
  }

  return {
    eosData,
    transcriptContext,
    sources,
  }
}

/**
 * Extract meaningful search terms from a query
 */
function extractSearchTerms(query: string): string[] {
  // Remove common stop words and extract meaningful terms
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'as', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'between', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
    'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'and', 'but', 'or', 'yet', 'if', 'because', 'until', 'while',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
    'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his',
    'she', 'her', 'it', 'its', 'they', 'them', 'their', 'am',
  ])

  const words = query.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word))

  // Return unique terms
  return [...new Set(words)]
}

/**
 * Build the full system context for chat
 */
export function buildChatContext(context: ChatContext): string {
  const sections: string[] = []

  if (context.eosData) {
    sections.push('# Current EOS Data\n' + context.eosData)
  }

  if (context.transcriptContext) {
    sections.push(context.transcriptContext)
  }

  if (sections.length === 0) {
    return ''
  }

  return `\n\n---\n\n## Context from Caldera's EOS System\n\n${sections.join('\n\n')}`
}
