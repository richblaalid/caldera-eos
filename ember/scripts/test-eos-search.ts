/**
 * Test EOS Knowledge Search
 * Run with: npx tsx scripts/test-eos-search.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { generateEmbedding } from '../src/lib/embeddings'

async function testEOSSearch() {
  console.log('='.repeat(60))
  console.log('Testing EOS Knowledge Semantic Search')
  console.log('='.repeat(60))

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const testQueries = [
    'What are Core Values in EOS?',
    'How does the IDS process work?',
    'What is the purpose of Rocks?',
    'Explain the Level 10 Meeting structure',
  ]

  for (const query of testQueries) {
    console.log(`\n📝 Query: "${query}"`)
    console.log('-'.repeat(50))

    // Generate embedding for query
    const embedding = await generateEmbedding(query)

    // Search using the PostgreSQL function
    const { data, error } = await supabase.rpc('match_eos_knowledge', {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 3,
    })

    if (error) {
      console.error('Search error:', error.message)
      continue
    }

    if (!data || data.length === 0) {
      console.log('No results found')
      continue
    }

    console.log(`Found ${data.length} results:\n`)
    for (const result of data) {
      console.log(`  📖 ${result.chapter_title}`)
      console.log(`     Section: ${result.section_heading || 'General'}`)
      console.log(`     Similarity: ${(result.similarity * 100).toFixed(1)}%`)
      console.log(`     Preview: "${result.content.slice(0, 150)}..."`)
      console.log()
    }
  }

  console.log('='.repeat(60))
  console.log('EOS Knowledge Search Test Complete!')
  console.log('='.repeat(60))
}

testEOSSearch().catch(console.error)
