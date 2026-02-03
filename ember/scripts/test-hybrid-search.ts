/**
 * Test Hybrid Search
 * Run with: npx tsx scripts/test-hybrid-search.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { generateEmbedding } from '../src/lib/embeddings'

// RRF constant
const RRF_K = 60

interface SearchResult {
  id: string
  content: string
  source: 'transcript' | 'eos_knowledge'
  score: number
  metadata: Record<string, unknown>
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase credentials')
  }

  return createClient(url, key)
}

async function keywordSearchEOS(
  supabase: ReturnType<typeof createClient>,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  if (words.length === 0) return []

  const { data, error } = await supabase
    .from('eos_knowledge_chunks')
    .select('id, content, chapter_title, section_heading')
    .or(words.map((w) => `content.ilike.%${w}%`).join(','))
    .limit(limit)

  if (error) {
    console.error('Keyword search error:', error)
    return []
  }

  return (data || []).map((row) => {
    const contentLower = row.content.toLowerCase()
    const matchCount = words.filter((w) => contentLower.includes(w)).length
    return {
      id: row.id,
      content: row.content,
      source: 'eos_knowledge' as const,
      score: matchCount / words.length,
      metadata: {
        chapterTitle: row.chapter_title,
        sectionHeading: row.section_heading,
      },
    }
  }).sort((a, b) => b.score - a.score)
}

async function semanticSearchEOS(
  supabase: ReturnType<typeof createClient>,
  queryEmbedding: number[],
  threshold: number,
  limit: number
): Promise<SearchResult[]> {
  const { data, error } = await supabase.rpc('match_eos_knowledge', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
  })

  if (error) {
    console.error('Semantic search error:', error)
    return []
  }

  return (data || []).map((row: {
    id: string
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
    },
  }))
}

function fuseWithRRF(
  keywordResults: SearchResult[],
  semanticResults: SearchResult[]
): SearchResult[] {
  const resultMap = new Map<string, { result: SearchResult; rrfScore: number }>()

  keywordResults.forEach((result, index) => {
    resultMap.set(result.id, {
      result,
      rrfScore: 1 / (RRF_K + index + 1),
    })
  })

  semanticResults.forEach((result, index) => {
    const existing = resultMap.get(result.id)
    if (existing) {
      existing.rrfScore += 1 / (RRF_K + index + 1)
    } else {
      resultMap.set(result.id, {
        result,
        rrfScore: 1 / (RRF_K + index + 1),
      })
    }
  })

  return Array.from(resultMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map((r) => ({ ...r.result, score: r.rrfScore }))
}

async function testSearch(query: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Query: "${query}"`)
  console.log('='.repeat(60))

  const supabase = getSupabaseClient()
  const limit = 5

  // Keyword search
  console.log('\n--- Keyword Search ---')
  const keywordResults = await keywordSearchEOS(supabase, query, limit)
  if (keywordResults.length === 0) {
    console.log('No keyword results')
  } else {
    keywordResults.forEach((r, i) => {
      console.log(`${i + 1}. [${(r.score * 100).toFixed(0)}%] ${r.metadata.chapterTitle} - ${r.metadata.sectionHeading}`)
      console.log(`   "${r.content.slice(0, 100)}..."`)
    })
  }

  // Semantic search
  console.log('\n--- Semantic Search ---')
  const embedding = await generateEmbedding(query)
  const semanticResults = await semanticSearchEOS(supabase, embedding, 0.5, limit)
  if (semanticResults.length === 0) {
    console.log('No semantic results')
  } else {
    semanticResults.forEach((r, i) => {
      console.log(`${i + 1}. [${(r.score * 100).toFixed(1)}%] ${r.metadata.chapterTitle} - ${r.metadata.sectionHeading}`)
      console.log(`   "${r.content.slice(0, 100)}..."`)
    })
  }

  // Hybrid (RRF)
  console.log('\n--- Hybrid Search (RRF) ---')
  const hybridResults = fuseWithRRF(keywordResults, semanticResults)
  if (hybridResults.length === 0) {
    console.log('No hybrid results')
  } else {
    hybridResults.slice(0, limit).forEach((r, i) => {
      console.log(`${i + 1}. [RRF: ${r.score.toFixed(4)}] ${r.metadata.chapterTitle} - ${r.metadata.sectionHeading}`)
      console.log(`   "${r.content.slice(0, 100)}..."`)
    })
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('Hybrid Search Test')
  console.log('='.repeat(60))

  const testQueries = [
    'What are Core Values?',
    'How do I run an effective L10 meeting?',
    'IDS process for solving issues',
    'quarterly priorities rocks',
  ]

  for (const query of testQueries) {
    await testSearch(query)
  }

  console.log('\n' + '='.repeat(60))
  console.log('Test Complete!')
  console.log('='.repeat(60))
}

main().catch(console.error)
