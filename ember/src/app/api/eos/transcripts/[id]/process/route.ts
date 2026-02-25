import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getTranscript,
  updateTranscript,
  createTranscriptChunks,
} from '@/lib/eos'
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

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/eos/transcripts/[id]/process - Process a transcript
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const transcript = await getTranscript(id)

    if (!transcript.full_text) {
      return NextResponse.json(
        { error: 'Transcript has no content to process' },
        { status: 400 }
      )
    }

    // Step 1: Chunk the transcript
    const chunks = chunkTranscript(transcript.full_text, id)

    // Step 1.5: Generate embeddings for semantic search
    let chunksWithEmbeddings = chunks
    try {
      console.log(`Generating embeddings for ${chunks.length} chunks...`)
      chunksWithEmbeddings = await generateChunkEmbeddings(chunks)
      console.log('Embeddings generated successfully')
    } catch (embeddingError) {
      console.error('Error generating embeddings:', embeddingError)
      // Continue without embeddings - they can be backfilled later
    }

    // Save chunks to database
    if (chunksWithEmbeddings.length > 0) {
      // Delete existing chunks first
      await supabase.from('transcript_chunks').delete().eq('transcript_id', id)
      // Create new chunks with embeddings
      await createTranscriptChunks(chunksWithEmbeddings)
    }

    // Step 2: Extract items from each chunk
    const extractionResults = []
    for (let i = 0; i < chunks.length; i++) {
      // Use previous chunk as context
      const context = i > 0 ? chunks[i - 1].content.slice(-500) : ''
      const result = await extractFromChunk(chunks[i].content, context)
      extractionResults.push(result)
    }

    // Step 3: Merge and deduplicate extractions
    const mergedExtractions = mergeExtractionResults(extractionResults)

    // Step 3.5: Generate metric suggestions from extracted metrics
    let metricSuggestionsCreated = 0
    if (mergedExtractions.metrics && mergedExtractions.metrics.length > 0) {
      try {
        const suggestionIds = await generateMetricSuggestions(
          mergedExtractions.metrics,
          id,
          transcript.title || 'Meeting Transcript'
        )
        metricSuggestionsCreated = suggestionIds.length
        console.log(`Created ${metricSuggestionsCreated} metric suggestions`)
      } catch (suggestionError) {
        console.error('Error creating metric suggestions:', suggestionError)
        // Continue - suggestions are optional
      }
    }

    // Step 3.6: Generate todo suggestions from extracted todos
    let todoSuggestionsCreated = 0
    if (mergedExtractions.todos && mergedExtractions.todos.length > 0) {
      try {
        const ids = await generateTodoSuggestions(
          mergedExtractions.todos, id, transcript.title || 'Meeting Transcript'
        )
        todoSuggestionsCreated = ids.length
      } catch (e) {
        console.error('Error creating todo suggestions:', e)
      }
    }

    // Step 3.7: Generate issue suggestions from extracted issues
    let issueSuggestionsCreated = 0
    if (mergedExtractions.issues && mergedExtractions.issues.length > 0) {
      try {
        const ids = await generateIssueSuggestions(
          mergedExtractions.issues, id, transcript.title || 'Meeting Transcript'
        )
        issueSuggestionsCreated = ids.length
      } catch (e) {
        console.error('Error creating issue suggestions:', e)
      }
    }

    // Step 4: Generate overall summary
    const summary = await generateTranscriptSummary(transcript.full_text)

    // Step 5: Update transcript as processed with extractions
    const updated = await updateTranscript(id, {
      processed: true,
      processed_at: new Date().toISOString(),
      summary: summary || mergedExtractions.summary || null,
      extractions: mergedExtractions,
    })

    return NextResponse.json({
      ...updated,
      chunks_created: chunks.length,
      extractions: mergedExtractions,
      metric_suggestions_created: metricSuggestionsCreated,
      todo_suggestions_created: todoSuggestionsCreated,
      issue_suggestions_created: issueSuggestionsCreated,
    })
  } catch (error) {
    console.error('Error processing transcript:', error)
    return NextResponse.json(
      { error: 'Failed to process transcript' },
      { status: 500 }
    )
  }
}
