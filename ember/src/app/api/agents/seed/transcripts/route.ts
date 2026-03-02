import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
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
export const maxDuration = 300 // 5 minutes for bulk processing

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Schema for AI-extracted transcript metadata
const transcriptMetadataSchema = z.object({
  title: z.string().describe('A short, descriptive meeting title (e.g. "Caldera L10 Meeting", "Acme Client Kickoff")'),
  meeting_date: z.string().nullable().describe('ISO 8601 date string if detectable from the content, null if not clear'),
  participants: z.array(z.string()).describe('List of participant names detected in the transcript'),
  meeting_type: z.enum(['l10', 'sales_call', 'client_delivery', '1on1', 'internal', 'other']).describe('Best classification of this meeting'),
  summary_hint: z.string().describe('One sentence description of what this meeting was about'),
})

/**
 * POST /api/agents/seed/transcripts
 *
 * Bulk-imports transcript text, auto-extracts metadata via AI, then runs
 * the full processing pipeline (chunking, embeddings, extraction, summary).
 *
 * Body: {
 *   organization_id?: string,  // defaults to Caldera org
 *   transcripts: Array<{
 *     text: string,            // Full transcript text (required)
 *     title?: string,          // Optional — AI will extract if missing
 *     meeting_date?: string,   // Optional — AI will extract if missing
 *     participants?: string[], // Optional — AI will extract if missing
 *     source?: string,         // 'upload' | 'grain' | 'google_docs' etc.
 *   }>
 * }
 *
 * Or for simple single-file testing:
 * Body: { text: string, organization_id?: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authError = verifyCronAuth(request)
    if (authError) return authError

    const body = await request.json()
    const orgId = body.organization_id || '00000000-0000-0000-0000-000000000001'

    // Normalize input: support both single transcript and batch
    const MAX_TRANSCRIPTS = 50
    const MAX_TEXT_LENGTH = 200_000

    let transcriptInputs: Array<{
      text: string
      title?: string
      meeting_date?: string
      participants?: string[]
      source?: string
    }>

    if (body.transcripts) {
      if (!Array.isArray(body.transcripts) || body.transcripts.length > MAX_TRANSCRIPTS) {
        return NextResponse.json({ error: `Too many transcripts (max ${MAX_TRANSCRIPTS})` }, { status: 400 })
      }
      transcriptInputs = body.transcripts
    } else if (body.text) {
      transcriptInputs = [body]
    } else {
      return NextResponse.json({ error: 'Provide "text" or "transcripts" array' }, { status: 400 })
    }

    const results = {
      total: transcriptInputs.length,
      created: 0,
      processed: 0,
      skipped: 0,
      errors: [] as string[],
    }

    for (let i = 0; i < transcriptInputs.length; i++) {
      const input = transcriptInputs[i]

      if (!input.text || input.text.trim().length < 50) {
        results.skipped++
        results.errors.push(`Transcript ${i}: text too short or empty`)
        continue
      }

      if (input.text.length > MAX_TEXT_LENGTH) {
        results.skipped++
        results.errors.push(`Transcript ${i}: text too long (max ${MAX_TEXT_LENGTH} chars)`)
        continue
      }

      try {
        console.log(`[Seed] Processing transcript ${i + 1}/${transcriptInputs.length}...`)

        // Step 1: Extract metadata if not provided
        const metadata = await extractMetadata(input)

        // Step 2: Insert transcript record
        const { data: transcript, error: insertError } = await supabaseAdmin
          .from('transcripts')
          .insert({
            organization_id: orgId,
            title: metadata.title,
            full_text: input.text,
            meeting_date: metadata.meeting_date,
            participants: metadata.participants,
            source: input.source || 'upload',
            processed: false,
          })
          .select('id')
          .single()

        if (insertError || !transcript) {
          results.errors.push(`Transcript ${i} insert: ${insertError?.message || 'unknown'}`)
          continue
        }

        results.created++
        const transcriptId = transcript.id

        // Step 3: Run the full processing pipeline
        try {
          await processTranscript(transcriptId, input.text, metadata.title, orgId)
          results.processed++
        } catch (procError: unknown) {
          const pErr = procError as { message?: string }
          results.errors.push(`Transcript ${i} processing: ${pErr.message || 'unknown'}`)
          // Still created, just not processed — can retry later
        }
      } catch (error: unknown) {
        const err = error as { message?: string }
        results.errors.push(`Transcript ${i}: ${err.message || 'unknown'}`)
      }
    }

    console.log('[Seed] Transcript seeding complete:', results)

    return NextResponse.json({
      message: `Seeded ${results.created} transcripts, processed ${results.processed}`,
      ...results,
    })
  } catch (error) {
    console.error('Transcript seed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Extract metadata from transcript text using AI.
 * Uses provided values when available, fills gaps with AI extraction.
 */
async function extractMetadata(input: {
  text: string
  title?: string
  meeting_date?: string
  participants?: string[]
}): Promise<{
  title: string
  meeting_date: string | null
  participants: string[]
}> {
  // If all metadata is provided, skip AI
  if (input.title && input.meeting_date && input.participants?.length) {
    return {
      title: input.title,
      meeting_date: input.meeting_date,
      participants: input.participants,
    }
  }

  // Use first ~4000 chars for metadata extraction (fast, cheap)
  const textSample = input.text.slice(0, 4000)
  const model = process.env.AGENT_FAST_MODEL || 'claude-haiku-4-5-20251001'

  try {
    const { object } = await generateObject({
      model: anthropic(model),
      schema: transcriptMetadataSchema,
      prompt: `Extract metadata from this meeting transcript. Identify the meeting title, date (if mentioned), participants, and meeting type.\n\nTranscript (first portion):\n${textSample}`,
      system: 'You extract structured metadata from meeting transcripts. Be precise with names. If no date is explicitly mentioned, return null for meeting_date.',
    })

    return {
      title: input.title || object.title,
      meeting_date: input.meeting_date || object.meeting_date,
      participants: input.participants?.length ? input.participants : object.participants,
    }
  } catch {
    // Fallback: use provided values or defaults
    return {
      title: input.title || 'Imported Transcript',
      meeting_date: input.meeting_date || null,
      participants: input.participants || [],
    }
  }
}

/**
 * Run the full processing pipeline on a transcript.
 * This mirrors the logic in /api/eos/transcripts/[id]/process/route.ts
 * but uses the service client (no auth needed).
 */
async function processTranscript(transcriptId: string, fullText: string, title: string, orgId: string): Promise<void> {
  // Step 1: Chunk
  const chunks = chunkTranscript(fullText, transcriptId)

  // Step 1.5: Embeddings
  let chunksWithEmbeddings = chunks
  try {
    chunksWithEmbeddings = await generateChunkEmbeddings(chunks)
  } catch (embeddingError) {
    console.error(`[Seed] Embedding error for ${transcriptId}:`, embeddingError)
    // Continue without embeddings
  }

  // Save chunks (using service client, not user client)
  if (chunksWithEmbeddings.length > 0) {
    await supabaseAdmin.from('transcript_chunks').delete().eq('transcript_id', transcriptId)
    const { error: chunkError } = await supabaseAdmin
      .from('transcript_chunks')
      .insert(chunksWithEmbeddings)
    if (chunkError) {
      console.error(`[Seed] Chunk insert error for ${transcriptId}:`, chunkError)
    }
  }

  // Step 2: Extract items from each chunk
  const extractionResults = []
  for (let i = 0; i < chunks.length; i++) {
    const context = i > 0 ? chunks[i - 1].content.slice(-500) : ''
    const result = await extractFromChunk(chunks[i].content, context)
    extractionResults.push(result)
  }

  // Step 3: Merge and deduplicate
  const mergedExtractions = mergeExtractionResults(extractionResults)

  // Step 3.5: Metric suggestions
  if (mergedExtractions.metrics && mergedExtractions.metrics.length > 0) {
    try {
      await generateMetricSuggestions(mergedExtractions.metrics, transcriptId, title)
    } catch {
      // Suggestions are optional
    }
  }

  // Step 3.6: Todo suggestions
  if (mergedExtractions.todos && mergedExtractions.todos.length > 0) {
    try {
      await generateTodoSuggestions(mergedExtractions.todos, transcriptId, title, orgId)
    } catch {
      // Suggestions are optional
    }
  }

  // Step 3.7: Issue suggestions
  if (mergedExtractions.issues && mergedExtractions.issues.length > 0) {
    try {
      await generateIssueSuggestions(mergedExtractions.issues, transcriptId, title, orgId)
    } catch {
      // Suggestions are optional
    }
  }

  // Step 4: Generate summary
  const summary = await generateTranscriptSummary(fullText)

  // Step 5: Mark as processed
  await supabaseAdmin
    .from('transcripts')
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
      summary: summary || mergedExtractions.summary || null,
      extractions: mergedExtractions,
    })
    .eq('id', transcriptId)
}
