/**
 * Test script for embedding generation
 * Run with: npx tsx scripts/test-embeddings.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { generateEmbedding, generateEmbeddings, __testing } from '../src/lib/embeddings'

async function testSingleEmbedding() {
  console.log('Testing single embedding generation...')

  const testText = 'What are the Core Values of an EOS company?'
  const embedding = await generateEmbedding(testText)

  console.log(`✓ Generated embedding for: "${testText}"`)
  console.log(`  Dimensions: ${embedding.length}`)
  console.log(`  Expected: ${__testing.EMBEDDING_DIMENSIONS}`)
  console.log(`  First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(6)).join(', ')}]`)

  if (embedding.length !== __testing.EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected ${__testing.EMBEDDING_DIMENSIONS} dimensions, got ${embedding.length}`)
  }

  console.log('✓ Single embedding test passed!\n')
}

async function testBatchEmbeddings() {
  console.log('Testing batch embedding generation...')

  const testTexts = [
    'Rocks are 90-day priorities',
    'Scorecard tracks weekly metrics',
    'IDS stands for Identify, Discuss, Solve',
  ]

  const embeddings = await generateEmbeddings(testTexts)

  console.log(`✓ Generated ${embeddings.length} embeddings`)

  for (let i = 0; i < embeddings.length; i++) {
    console.log(`  [${i}] "${testTexts[i].slice(0, 30)}..." → ${embeddings[i].length} dims`)

    if (embeddings[i].length !== __testing.EMBEDDING_DIMENSIONS) {
      throw new Error(`Embedding ${i} has wrong dimensions`)
    }
  }

  console.log('✓ Batch embedding test passed!\n')
}

async function main() {
  console.log('='.repeat(50))
  console.log('Ember RAG - Embedding Service Tests')
  console.log('='.repeat(50))
  console.log(`Model: ${__testing.EMBEDDING_MODEL}`)
  console.log(`Dimensions: ${__testing.EMBEDDING_DIMENSIONS}`)
  console.log('='.repeat(50) + '\n')

  try {
    await testSingleEmbedding()
    await testBatchEmbeddings()

    console.log('='.repeat(50))
    console.log('All tests passed! ✓')
    console.log('='.repeat(50))
  } catch (error) {
    console.error('\n✗ Test failed:', error)
    process.exit(1)
  }
}

main()
