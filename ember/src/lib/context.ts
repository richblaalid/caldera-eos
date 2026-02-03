/**
 * Context Retrieval for Ember Chat
 * Fetches relevant EOS data and transcript context for AI responses
 * Uses hybrid search (keyword + semantic) for better retrieval
 */

import { createClient } from '@/lib/supabase/server'
import {
  formatEOSContext,
  determineJourneyStage,
  formatVTOSummary,
  type EOSJourneyStage,
} from '@/lib/ember'
import { hybridSearch, type SearchResult } from '@/lib/hybrid-search'
import type { VTO } from '@/types/database'

// =============================================
// Types
// =============================================

export type QueryIntent = 'methodology' | 'historical' | 'current_state' | 'facilitation' | 'general'

export interface SourceReference {
  type: 'eos_knowledge' | 'transcript' | 'current_data'
  title: string
  section?: string
}

export interface ChatContext {
  eosData: string
  transcriptContext: string
  eosKnowledgeContext: string
  sources: string[]
  sourceReferences: SourceReference[]
  vto: VTO | null
  journeyStage: EOSJourneyStage
  vtoSummary: string
  queryIntent: QueryIntent
}

// =============================================
// Intent Classification
// =============================================

const METHODOLOGY_KEYWORDS = [
  'eos', 'traction', 'how does', 'what is', 'explain', 'define',
  'methodology', 'framework', 'process', 'best practice', 'according to',
  'supposed to', 'should i', 'how to run', 'how to do',
]

const HISTORICAL_KEYWORDS = [
  'last meeting', 'discussed', 'talked about', 'mentioned',
  'previous', 'history', 'before', 'earlier', 'past',
  'what did we', 'when did we', 'remember',
]

const CURRENT_STATE_KEYWORDS = [
  'current', 'status', 'update', 'progress', 'today',
  'this week', 'this quarter', 'how are we', 'where are we',
  'metrics', 'scorecard', 'rocks', 'issues', 'todos',
]

const FACILITATION_KEYWORDS = [
  'prepare', 'facilitate', 'run', 'agenda', 'l10',
  'meeting', 'session', 'quarterly', 'annual',
]

/**
 * Classify the intent of a query to optimize context retrieval
 */
export function classifyIntent(query: string): QueryIntent {
  const lowerQuery = query.toLowerCase()

  // Check for facilitation keywords first (most specific)
  if (FACILITATION_KEYWORDS.some((kw) => lowerQuery.includes(kw))) {
    return 'facilitation'
  }

  // Check for methodology questions
  if (METHODOLOGY_KEYWORDS.some((kw) => lowerQuery.includes(kw))) {
    return 'methodology'
  }

  // Check for historical lookups
  if (HISTORICAL_KEYWORDS.some((kw) => lowerQuery.includes(kw))) {
    return 'historical'
  }

  // Check for current state queries
  if (CURRENT_STATE_KEYWORDS.some((kw) => lowerQuery.includes(kw))) {
    return 'current_state'
  }

  return 'general'
}

// =============================================
// Context Budget Management
// =============================================

const MAX_CONTEXT_CHARS = 12000 // ~3000 tokens
const BUDGET_ALLOCATION = {
  methodology: { eos_knowledge: 0.6, transcripts: 0.2, current: 0.2 },
  historical: { eos_knowledge: 0.2, transcripts: 0.6, current: 0.2 },
  current_state: { eos_knowledge: 0.2, transcripts: 0.2, current: 0.6 },
  facilitation: { eos_knowledge: 0.4, transcripts: 0.3, current: 0.3 },
  general: { eos_knowledge: 0.4, transcripts: 0.3, current: 0.3 },
}

function allocateBudget(intent: QueryIntent) {
  const allocation = BUDGET_ALLOCATION[intent]
  return {
    eosKnowledge: Math.floor(MAX_CONTEXT_CHARS * allocation.eos_knowledge),
    transcripts: Math.floor(MAX_CONTEXT_CHARS * allocation.transcripts),
    current: Math.floor(MAX_CONTEXT_CHARS * allocation.current),
  }
}

function trimToLength(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  // Trim to last complete sentence
  const trimmed = text.slice(0, maxLength)
  const lastPeriod = trimmed.lastIndexOf('.')
  if (lastPeriod > maxLength * 0.7) {
    return trimmed.slice(0, lastPeriod + 1)
  }
  return trimmed + '...'
}

// =============================================
// Search Result Formatting
// =============================================

function formatEOSKnowledgeResults(
  results: SearchResult[],
  maxChars: number
): { text: string; refs: SourceReference[] } {
  if (results.length === 0) return { text: '', refs: [] }

  const refs: SourceReference[] = []
  let text = '## EOS Methodology Reference\n\n'
  let charCount = text.length

  for (const result of results) {
    const chapter = result.metadata.chapterTitle || 'EOS'
    const section = result.metadata.sectionHeading || ''
    const header = `### ${chapter}${section ? ` - ${section}` : ''}\n`
    const content = result.content + '\n\n'

    if (charCount + header.length + content.length > maxChars) {
      // Add truncated content if we have room
      const remaining = maxChars - charCount - header.length
      if (remaining > 200) {
        text += header + trimToLength(result.content, remaining) + '\n\n'
        refs.push({ type: 'eos_knowledge', title: chapter, section })
      }
      break
    }

    text += header + content
    charCount += header.length + content.length
    refs.push({ type: 'eos_knowledge', title: chapter, section })
  }

  return { text, refs }
}

function formatTranscriptResults(
  results: SearchResult[],
  maxChars: number
): { text: string; refs: SourceReference[] } {
  if (results.length === 0) return { text: '', refs: [] }

  const refs: SourceReference[] = []
  let text = '## Relevant Meeting Context\n\n'
  let charCount = text.length

  for (const result of results) {
    const speaker = result.metadata.speaker || 'Unknown'
    const header = `### From meeting transcript (${speaker}):\n`
    const content = result.content + '\n\n'

    if (charCount + header.length + content.length > maxChars) {
      const remaining = maxChars - charCount - header.length
      if (remaining > 200) {
        text += header + trimToLength(result.content, remaining) + '\n\n'
        refs.push({ type: 'transcript', title: 'Meeting Transcript', section: speaker })
      }
      break
    }

    text += header + content
    charCount += header.length + content.length
    refs.push({ type: 'transcript', title: 'Meeting Transcript', section: speaker })
  }

  return { text, refs }
}

// =============================================
// Main Context Retrieval
// =============================================

/**
 * Retrieve relevant context for a chat query
 * Uses hybrid search for semantic + keyword matching
 */
export async function retrieveContext(query: string): Promise<ChatContext> {
  const supabase = await createClient()
  const sources: string[] = []
  const sourceReferences: SourceReference[] = []

  // Classify query intent
  const queryIntent = classifyIntent(query)
  const budget = allocateBudget(queryIntent)

  // Fetch V/TO first to determine journey stage
  const { data: vtoData } = await supabase
    .from('vto')
    .select('*')
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const vto = vtoData as VTO | null
  const journeyStage = determineJourneyStage(vto)
  const vtoSummary = formatVTOSummary(vto)

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

  let eosData = formatEOSContext({ rocks, issues, todos, metrics })
  eosData = trimToLength(eosData, budget.current)

  if (rocks.length > 0) {
    sources.push('rocks')
    sourceReferences.push({ type: 'current_data', title: 'Current Rocks' })
  }
  if (issues.length > 0) {
    sources.push('issues')
    sourceReferences.push({ type: 'current_data', title: 'Open Issues' })
  }
  if (todos.length > 0) {
    sources.push('todos')
    sourceReferences.push({ type: 'current_data', title: 'Active To-Dos' })
  }
  if (metrics.length > 0) {
    sources.push('scorecard')
    sourceReferences.push({ type: 'current_data', title: 'Scorecard' })
  }

  // Use hybrid search for EOS knowledge and transcripts
  let eosKnowledgeContext = ''
  let transcriptContext = ''

  try {
    // Search both sources in parallel
    const [eosKnowledgeResults, transcriptResults] = await Promise.all([
      hybridSearch(query, {
        source: 'eos_knowledge',
        limit: 5,
        similarityThreshold: 0.45,
      }),
      hybridSearch(query, {
        source: 'transcripts',
        limit: 5,
        similarityThreshold: 0.45,
      }),
    ])

    // Format EOS knowledge results
    if (eosKnowledgeResults.length > 0) {
      const { text, refs } = formatEOSKnowledgeResults(eosKnowledgeResults, budget.eosKnowledge)
      eosKnowledgeContext = text
      sourceReferences.push(...refs)
      sources.push('eos_methodology')
    }

    // Format transcript results
    if (transcriptResults.length > 0) {
      const { text, refs } = formatTranscriptResults(transcriptResults, budget.transcripts)
      transcriptContext = text
      sourceReferences.push(...refs)
      sources.push('transcripts')
    }
  } catch (error) {
    console.error('Hybrid search error:', error)
    // Continue without search results if hybrid search fails
  }

  return {
    eosData,
    transcriptContext,
    eosKnowledgeContext,
    sources,
    sourceReferences,
    vto,
    journeyStage,
    vtoSummary,
    queryIntent,
  }
}

/**
 * Build the full system context for chat
 */
export function buildChatContext(context: ChatContext): string {
  const sections: string[] = []

  // Add EOS knowledge first (methodology reference)
  if (context.eosKnowledgeContext) {
    sections.push(context.eosKnowledgeContext)
  }

  // Add current EOS data
  if (context.eosData) {
    sections.push('## Current EOS Data\n\n' + context.eosData)
  }

  // Add transcript context
  if (context.transcriptContext) {
    sections.push(context.transcriptContext)
  }

  if (sections.length === 0) {
    return ''
  }

  // Add source attribution
  const sourceList = context.sourceReferences
    .filter((ref, index, self) =>
      self.findIndex((r) => r.title === ref.title && r.section === ref.section) === index
    )
    .map((ref) => `- ${ref.title}${ref.section ? `: ${ref.section}` : ''}`)
    .join('\n')

  const attribution = sourceList ? `\n\n### Sources Used\n${sourceList}` : ''

  return `\n\n---\n\n## Context from Caldera's EOS System\n\n${sections.join('\n\n')}${attribution}`
}
