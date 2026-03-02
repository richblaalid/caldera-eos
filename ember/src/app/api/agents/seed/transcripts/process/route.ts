import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  chunkTranscript,
  generateChunkEmbeddings,
  extractFromChunk,
  mergeExtractionResults,
  generateTranscriptSummary,
} from '@/lib/transcripts'
import { generateMetricSuggestions } from '@/lib/metric-suggestions'
import { generateTodoSuggestions } from '@/lib/todo-suggestions'
import { generateIssueSuggestions } from '@/lib/issue-suggestions'
import { verifyCronAuth } from '@/lib/agents/ingest-helpers'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/agents/seed/transcripts/process
 *
 * Process a single existing transcript by ID.
 * Runs: chunking → embeddings → extraction → summary → mark processed
 *
 * Body: { transcript_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const { transcript_id } = await request.json()
    if (!transcript_id) {
      return NextResponse.json({ error: 'transcript_id required' }, { status: 400 })
    }

    // Fetch the transcript
    const { data: transcript, error: fetchError } = await supabaseAdmin
      .from('transcripts')
      .select('id, title, full_text, processed, organization_id')
      .eq('id', transcript_id)
      .single()

    if (fetchError || !transcript) {
      return NextResponse.json({ error: `Transcript not found: ${fetchError?.message}` }, { status: 404 })
    }

    if (transcript.processed) {
      return NextResponse.json({ message: 'Already processed', skipped: true })
    }

    if (!transcript.full_text || transcript.full_text.length < 50) {
      return NextResponse.json({ error: 'Transcript text too short' }, { status: 400 })
    }

    const title = transcript.title || 'Untitled'
    console.log(`[Process] Starting: "${title}" (${transcript.full_text.length} chars)`)

    // Step 1: Chunk
    const chunks = chunkTranscript(transcript.full_text, transcript_id)

    // Step 2: Embeddings
    let chunksWithEmbeddings = chunks
    try {
      chunksWithEmbeddings = await generateChunkEmbeddings(chunks)
    } catch (embeddingError) {
      console.error(`[Process] Embedding error for ${transcript_id}:`, embeddingError)
    }

    // Save chunks
    if (chunksWithEmbeddings.length > 0) {
      await supabaseAdmin.from('transcript_chunks').delete().eq('transcript_id', transcript_id)
      const { error: chunkError } = await supabaseAdmin
        .from('transcript_chunks')
        .insert(chunksWithEmbeddings)
      if (chunkError) {
        console.error(`[Process] Chunk insert error:`, chunkError)
      }
    }

    // Step 3: Extract items from each chunk
    const extractionResults = []
    for (let i = 0; i < chunks.length; i++) {
      const context = i > 0 ? chunks[i - 1].content.slice(-500) : ''
      const result = await extractFromChunk(chunks[i].content, context)
      extractionResults.push(result)
    }

    // Step 4: Merge and deduplicate
    const mergedExtractions = mergeExtractionResults(extractionResults)

    // Step 4.5: Metric suggestions
    const orgId = transcript.organization_id
    if (mergedExtractions.metrics && mergedExtractions.metrics.length > 0) {
      try {
        await generateMetricSuggestions(mergedExtractions.metrics, transcript_id, title)
      } catch {
        // Optional
      }
    }

    // Step 4.6: Todo suggestions
    if (mergedExtractions.todos && mergedExtractions.todos.length > 0) {
      try {
        await generateTodoSuggestions(mergedExtractions.todos, transcript_id, title, orgId)
      } catch {
        // Optional
      }
    }

    // Step 4.7: Issue suggestions
    if (mergedExtractions.issues && mergedExtractions.issues.length > 0) {
      try {
        await generateIssueSuggestions(mergedExtractions.issues, transcript_id, title, orgId)
      } catch {
        // Optional
      }
    }

    // Step 5: Generate summary
    const summary = await generateTranscriptSummary(transcript.full_text)

    // Step 6: Mark as processed
    await supabaseAdmin
      .from('transcripts')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        summary: summary || mergedExtractions.summary || null,
        extractions: mergedExtractions,
      })
      .eq('id', transcript_id)

    console.log(`[Process] Complete: "${title}"`)

    return NextResponse.json({
      message: `Processed "${title}"`,
      chunks_created: chunks.length,
      summary: !!summary,
      extractions: {
        todos: mergedExtractions.todos?.length || 0,
        decisions: mergedExtractions.decisions?.length || 0,
        metrics: mergedExtractions.metrics?.length || 0,
      },
    })
  } catch (error) {
    console.error('Process transcript error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
