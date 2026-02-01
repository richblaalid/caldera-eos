import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getTranscript,
  updateTranscript,
  createTranscriptChunks,
} from '@/lib/eos'
import {
  chunkTranscript,
  extractFromChunk,
  mergeExtractionResults,
  generateTranscriptSummary,
} from '@/lib/transcripts'

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

    // Save chunks to database
    if (chunks.length > 0) {
      // Delete existing chunks first
      await supabase.from('transcript_chunks').delete().eq('transcript_id', id)
      // Create new chunks
      await createTranscriptChunks(chunks)
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

    // Step 4: Generate overall summary
    const summary = await generateTranscriptSummary(transcript.full_text)

    // Step 5: Update transcript as processed
    const updated = await updateTranscript(id, {
      processed: true,
      processed_at: new Date().toISOString(),
      summary: summary || mergedExtractions.summary || null,
    })

    return NextResponse.json({
      ...updated,
      chunks_created: chunks.length,
      extractions: mergedExtractions,
    })
  } catch (error) {
    console.error('Error processing transcript:', error)
    return NextResponse.json(
      { error: 'Failed to process transcript' },
      { status: 500 }
    )
  }
}
