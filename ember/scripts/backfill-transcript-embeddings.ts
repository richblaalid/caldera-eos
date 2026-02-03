/**
 * Backfill Transcript Embeddings Script
 * Generates embeddings for existing transcript chunks that don't have them
 *
 * Run with: npx tsx scripts/backfill-transcript-embeddings.ts
 *
 * Options:
 *   --batch-size=N    Number of chunks to process per batch (default: 50)
 *   --dry-run         Show what would be processed without making changes
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { generateEmbeddings } from '../src/lib/embeddings'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>

// =============================================
// Configuration
// =============================================

const DEFAULT_BATCH_SIZE = 50
const PROGRESS_INTERVAL = 10 // Log progress every N batches

// Parse command line arguments
const args = process.argv.slice(2)
const batchSize =
  parseInt(args.find((a) => a.startsWith('--batch-size='))?.split('=')[1] || '') ||
  DEFAULT_BATCH_SIZE
const dryRun = args.includes('--dry-run')

// =============================================
// Supabase Client
// =============================================

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, key)
}

// =============================================
// Backfill Functions
// =============================================

interface ChunkRow {
  id: string
  transcript_id: string
  content: string
  speaker: string | null
  chunk_index: number | null
}

async function getChunksWithoutEmbeddings(
  supabase: AnySupabaseClient,
  limit: number,
  offset: number
): Promise<ChunkRow[]> {
  const { data, error } = await supabase
    .from('transcript_chunks')
    .select('id, transcript_id, content, speaker, chunk_index')
    .is('embedding', null)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    throw new Error(`Failed to fetch chunks: ${error.message}`)
  }

  return data || []
}

async function countChunksWithoutEmbeddings(
  supabase: AnySupabaseClient
): Promise<number> {
  const { count, error } = await supabase
    .from('transcript_chunks')
    .select('*', { count: 'exact', head: true })
    .is('embedding', null)

  if (error) {
    throw new Error(`Failed to count chunks: ${error.message}`)
  }

  return count || 0
}

async function updateChunkEmbedding(
  supabase: AnySupabaseClient,
  chunkId: string,
  embedding: number[]
): Promise<void> {
  const { error } = await supabase
    .from('transcript_chunks')
    .update({ embedding })
    .eq('id', chunkId)

  if (error) {
    throw new Error(`Failed to update chunk ${chunkId}: ${error.message}`)
  }
}

// =============================================
// Main Process
// =============================================

async function main() {
  console.log('='.repeat(60))
  console.log('Transcript Embedding Backfill')
  console.log('='.repeat(60))
  console.log(`Batch size: ${batchSize}`)
  console.log(`Dry run: ${dryRun}`)
  console.log()

  const supabase = getSupabaseClient()

  // Get total count
  const totalChunks = await countChunksWithoutEmbeddings(supabase)
  console.log(`Found ${totalChunks} chunks without embeddings`)

  if (totalChunks === 0) {
    console.log('\n✓ All chunks already have embeddings!')
    return
  }

  if (dryRun) {
    console.log('\n[DRY RUN] Would process these chunks:')

    // Show sample of what would be processed
    const sample = await getChunksWithoutEmbeddings(supabase, Math.min(5, totalChunks), 0)
    for (const chunk of sample) {
      console.log(`  - Chunk ${chunk.id} (transcript: ${chunk.transcript_id})`)
      console.log(`    Content preview: "${chunk.content.slice(0, 80)}..."`)
    }

    if (totalChunks > 5) {
      console.log(`  ... and ${totalChunks - 5} more chunks`)
    }

    console.log('\n[DRY RUN] No changes made.')
    return
  }

  // Process in batches
  console.log(`\nStarting backfill...`)
  const startTime = Date.now()
  let processedCount = 0
  let errorCount = 0
  let batchNumber = 0

  while (processedCount < totalChunks) {
    batchNumber++

    // Always fetch from offset 0 since we're updating the rows
    // (rows with embeddings won't match the IS NULL filter anymore)
    const chunks = await getChunksWithoutEmbeddings(supabase, batchSize, 0)

    if (chunks.length === 0) {
      break // No more chunks to process
    }

    // Generate embeddings for batch
    const texts = chunks.map((c) => c.content)

    try {
      const embeddings = await generateEmbeddings(texts)

      // Update each chunk with its embedding
      for (let i = 0; i < chunks.length; i++) {
        try {
          await updateChunkEmbedding(supabase, chunks[i].id, embeddings[i])
          processedCount++
        } catch (updateError) {
          console.error(`Error updating chunk ${chunks[i].id}:`, updateError)
          errorCount++
        }
      }

      // Log progress
      if (batchNumber % PROGRESS_INTERVAL === 0 || processedCount >= totalChunks) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        const rate = (processedCount / parseFloat(elapsed)).toFixed(1)
        console.log(
          `  Progress: ${processedCount}/${totalChunks} (${((processedCount / totalChunks) * 100).toFixed(1)}%) - ${elapsed}s elapsed, ${rate} chunks/sec`
        )
      }
    } catch (embeddingError) {
      console.error(`Error generating embeddings for batch ${batchNumber}:`, embeddingError)
      errorCount += chunks.length

      // Brief pause before retrying with next batch
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  // Summary
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n' + '='.repeat(60))
  console.log('Backfill Complete!')
  console.log('='.repeat(60))
  console.log(`  Chunks processed: ${processedCount}`)
  console.log(`  Errors: ${errorCount}`)
  console.log(`  Total time: ${totalTime}s`)
  console.log(
    `  Average rate: ${(processedCount / parseFloat(totalTime)).toFixed(1)} chunks/sec`
  )
  console.log('='.repeat(60))
}

// Run
main().catch((error) => {
  console.error('\nBackfill failed:', error)
  process.exit(1)
})
