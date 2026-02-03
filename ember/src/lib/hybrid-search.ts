/**
 * Hybrid Search Service
 * Combines keyword and semantic search using Reciprocal Rank Fusion (RRF)
 */

import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from './embeddings'

// =============================================
// Types
// =============================================

export type SearchSource = 'transcripts' | 'eos_knowledge' | 'all'
export type SearchType = 'keyword' | 'semantic' | 'hybrid'

export interface SearchOptions {
  type?: SearchType
  source?: SearchSource
  limit?: number
  similarityThreshold?: number
  keywordMatchThreshold?: number
}

export interface SearchResult {
  id: string
  content: string
  source: 'transcript' | 'eos_knowledge'
  score: number
  metadata: {
    // For transcripts
    transcriptId?: string
    speaker?: string
    chunkIndex?: number
    // For EOS knowledge
    chapterTitle?: string
    sectionHeading?: string
    sourceFile?: string
  }
}

interface RankedResult {
  result: SearchResult
  keywordRank?: number
  semanticRank?: number
  rrfScore: number
}

// =============================================
// Configuration
// =============================================

const DEFAULT_LIMIT = 10
const DEFAULT_SIMILARITY_THRESHOLD = 0.5
const RRF_K = 60 // RRF constant (typically 60)

// =============================================
// Keyword Search
// =============================================

async function keywordSearchTranscripts(
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const supabase = await createClient()

  // Split query into words for better matching
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  if (words.length === 0) return []

  // Build ILIKE conditions for each word
  const { data, error } = await supabase
    .from('transcript_chunks')
    .select('id, transcript_id, content, speaker, chunk_index')
    .or(words.map((w) => `content.ilike.%${w}%`).join(','))
    .limit(limit * 2) // Fetch extra to account for filtering

  if (error) {
    console.error('Keyword search error (transcripts):', error)
    return []
  }

  // Score results by number of matching words
  return (data || [])
    .map((row) => {
      const contentLower = row.content.toLowerCase()
      const matchCount = words.filter((w) => contentLower.includes(w)).length
      const score = matchCount / words.length

      return {
        id: row.id,
        content: row.content,
        source: 'transcript' as const,
        score,
        metadata: {
          transcriptId: row.transcript_id,
          speaker: row.speaker,
          chunkIndex: row.chunk_index,
        },
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

async function keywordSearchEOSKnowledge(
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const supabase = await createClient()

  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  if (words.length === 0) return []

  const { data, error } = await supabase
    .from('eos_knowledge_chunks')
    .select('id, content, chapter_title, section_heading, source_file')
    .or(words.map((w) => `content.ilike.%${w}%`).join(','))
    .limit(limit * 2)

  if (error) {
    console.error('Keyword search error (EOS knowledge):', error)
    return []
  }

  return (data || [])
    .map((row) => {
      const contentLower = row.content.toLowerCase()
      const matchCount = words.filter((w) => contentLower.includes(w)).length
      const score = matchCount / words.length

      return {
        id: row.id,
        content: row.content,
        source: 'eos_knowledge' as const,
        score,
        metadata: {
          chapterTitle: row.chapter_title,
          sectionHeading: row.section_heading,
          sourceFile: row.source_file,
        },
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// =============================================
// Semantic Search
// =============================================

async function semanticSearchTranscripts(
  queryEmbedding: number[],
  threshold: number,
  limit: number
): Promise<SearchResult[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('match_transcript_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
  })

  if (error) {
    console.error('Semantic search error (transcripts):', error)
    return []
  }

  return (data || []).map((row: {
    id: string
    transcript_id: string
    content: string
    speaker: string | null
    chunk_index: number
    similarity: number
  }) => ({
    id: row.id,
    content: row.content,
    source: 'transcript' as const,
    score: row.similarity,
    metadata: {
      transcriptId: row.transcript_id,
      speaker: row.speaker,
      chunkIndex: row.chunk_index,
    },
  }))
}

async function semanticSearchEOSKnowledge(
  queryEmbedding: number[],
  threshold: number,
  limit: number
): Promise<SearchResult[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('match_eos_knowledge', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
  })

  if (error) {
    console.error('Semantic search error (EOS knowledge):', error)
    return []
  }

  return (data || []).map((row: {
    id: string
    source_file: string
    chapter_title: string
    section_heading: string
    content: string
    similarity: number
  }) => ({
    id: row.id,
    content: row.content,
    source: 'eos_knowledge' as const,
    score: row.similarity,
    metadata: {
      chapterTitle: row.chapter_title,
      sectionHeading: row.section_heading,
      sourceFile: row.source_file,
    },
  }))
}

// =============================================
// RRF Fusion
// =============================================

/**
 * Reciprocal Rank Fusion (RRF) algorithm
 * Combines multiple ranked lists into a single ranking
 * Formula: RRF(d) = sum(1 / (k + rank_i(d))) for each ranker i
 */
function fuseWithRRF(
  keywordResults: SearchResult[],
  semanticResults: SearchResult[]
): SearchResult[] {
  const resultMap = new Map<string, RankedResult>()

  // Process keyword results
  keywordResults.forEach((result, index) => {
    const key = `${result.source}:${result.id}`
    resultMap.set(key, {
      result,
      keywordRank: index + 1,
      rrfScore: 1 / (RRF_K + index + 1),
    })
  })

  // Process semantic results and merge
  semanticResults.forEach((result, index) => {
    const key = `${result.source}:${result.id}`
    const existing = resultMap.get(key)

    if (existing) {
      // Result exists in both - add semantic contribution
      existing.semanticRank = index + 1
      existing.rrfScore += 1 / (RRF_K + index + 1)
      // Use the higher score between the two
      if (result.score > existing.result.score) {
        existing.result.score = result.score
      }
    } else {
      // New result from semantic search
      resultMap.set(key, {
        result,
        semanticRank: index + 1,
        rrfScore: 1 / (RRF_K + index + 1),
      })
    }
  })

  // Sort by RRF score and return
  return Array.from(resultMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map((r) => ({
      ...r.result,
      score: r.rrfScore, // Use RRF score as final score
    }))
}

// =============================================
// Main Search Function
// =============================================

/**
 * Hybrid search combining keyword and semantic search
 */
export async function hybridSearch(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    type = 'hybrid',
    source = 'all',
    limit = DEFAULT_LIMIT,
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
  } = options

  // Generate embedding for semantic search if needed
  let queryEmbedding: number[] | null = null
  if (type === 'semantic' || type === 'hybrid') {
    try {
      queryEmbedding = await generateEmbedding(query)
    } catch (error) {
      console.error('Failed to generate query embedding:', error)
      // Fall back to keyword-only if embedding fails
      if (type === 'semantic') {
        return []
      }
    }
  }

  // Collect results based on search type and source
  let keywordResults: SearchResult[] = []
  let semanticResults: SearchResult[] = []

  // Keyword search
  if (type === 'keyword' || type === 'hybrid') {
    const keywordPromises: Promise<SearchResult[]>[] = []

    if (source === 'all' || source === 'transcripts') {
      keywordPromises.push(keywordSearchTranscripts(query, limit))
    }
    if (source === 'all' || source === 'eos_knowledge') {
      keywordPromises.push(keywordSearchEOSKnowledge(query, limit))
    }

    const keywordResultArrays = await Promise.all(keywordPromises)
    keywordResults = keywordResultArrays.flat()
  }

  // Semantic search
  if ((type === 'semantic' || type === 'hybrid') && queryEmbedding) {
    const semanticPromises: Promise<SearchResult[]>[] = []

    if (source === 'all' || source === 'transcripts') {
      semanticPromises.push(
        semanticSearchTranscripts(queryEmbedding, similarityThreshold, limit)
      )
    }
    if (source === 'all' || source === 'eos_knowledge') {
      semanticPromises.push(
        semanticSearchEOSKnowledge(queryEmbedding, similarityThreshold, limit)
      )
    }

    const semanticResultArrays = await Promise.all(semanticPromises)
    semanticResults = semanticResultArrays.flat()
  }

  // Combine results based on search type
  let results: SearchResult[]

  if (type === 'keyword') {
    results = keywordResults.sort((a, b) => b.score - a.score)
  } else if (type === 'semantic') {
    results = semanticResults.sort((a, b) => b.score - a.score)
  } else {
    // Hybrid - use RRF fusion
    results = fuseWithRRF(keywordResults, semanticResults)
  }

  // Apply final limit
  return results.slice(0, limit)
}

// =============================================
// Convenience Functions
// =============================================

/**
 * Search only transcripts
 */
export async function searchTranscripts(
  query: string,
  options: Omit<SearchOptions, 'source'> = {}
): Promise<SearchResult[]> {
  return hybridSearch(query, { ...options, source: 'transcripts' })
}

/**
 * Search only EOS knowledge base
 */
export async function searchEOSKnowledge(
  query: string,
  options: Omit<SearchOptions, 'source'> = {}
): Promise<SearchResult[]> {
  return hybridSearch(query, { ...options, source: 'eos_knowledge' })
}

/**
 * Keyword-only search
 */
export async function keywordSearch(
  query: string,
  options: Omit<SearchOptions, 'type'> = {}
): Promise<SearchResult[]> {
  return hybridSearch(query, { ...options, type: 'keyword' })
}

/**
 * Semantic-only search
 */
export async function semanticSearch(
  query: string,
  options: Omit<SearchOptions, 'type'> = {}
): Promise<SearchResult[]> {
  return hybridSearch(query, { ...options, type: 'semantic' })
}
