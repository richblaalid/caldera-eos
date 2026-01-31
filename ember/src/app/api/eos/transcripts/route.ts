import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTranscripts, createTranscript } from '@/lib/eos'
import type { TranscriptInsert } from '@/types/database'

// GET /api/eos/transcripts - List all transcripts with optional filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const meetingId = searchParams.get('meeting_id') || undefined
    const processedParam = searchParams.get('processed')
    const processed = processedParam === 'true' ? true : processedParam === 'false' ? false : undefined

    const transcripts = await getTranscripts({ meeting_id: meetingId, processed })
    return NextResponse.json(transcripts)
  } catch (error) {
    console.error('Error fetching transcripts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transcripts' },
      { status: 500 }
    )
  }
}

// POST /api/eos/transcripts - Create a new transcript
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate required field
    if (!body.full_text || typeof body.full_text !== 'string' || body.full_text.trim() === '') {
      return NextResponse.json(
        { error: 'Transcript text is required' },
        { status: 400 }
      )
    }

    const transcriptData: TranscriptInsert = {
      title: body.title || null,
      meeting_id: body.meeting_id || null,
      meeting_date: body.meeting_date || null,
      participants: body.participants || [],
      full_text: body.full_text.trim(),
      summary: body.summary || null,
      source: body.source || 'upload',
      file_path: body.file_path || null,
      processed: false,
    }

    const transcript = await createTranscript(transcriptData)

    return NextResponse.json(transcript, { status: 201 })
  } catch (error) {
    console.error('Error creating transcript:', error)
    return NextResponse.json(
      { error: 'Failed to create transcript' },
      { status: 500 }
    )
  }
}
