import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTranscript, updateTranscript, deleteTranscript } from '@/lib/eos'
import type { TranscriptInsert } from '@/types/database'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/eos/transcripts/[id] - Get a specific transcript
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const transcript = await getTranscript(id)
    return NextResponse.json(transcript)
  } catch (error) {
    console.error('Error fetching transcript:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transcript' },
      { status: 500 }
    )
  }
}

// PATCH /api/eos/transcripts/[id] - Update a transcript
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const updates: Partial<TranscriptInsert> = {}
    if (body.title !== undefined) updates.title = body.title
    if (body.meeting_id !== undefined) updates.meeting_id = body.meeting_id
    if (body.meeting_date !== undefined) updates.meeting_date = body.meeting_date
    if (body.participants !== undefined) updates.participants = body.participants
    if (body.full_text !== undefined) updates.full_text = body.full_text
    if (body.summary !== undefined) updates.summary = body.summary
    if (body.extractions !== undefined) updates.extractions = body.extractions
    if (body.processed !== undefined) updates.processed = body.processed
    if (body.processed_at !== undefined) updates.processed_at = body.processed_at

    const transcript = await updateTranscript(id, updates)
    return NextResponse.json(transcript)
  } catch (error) {
    console.error('Error updating transcript:', error)
    return NextResponse.json(
      { error: 'Failed to update transcript' },
      { status: 500 }
    )
  }
}

// DELETE /api/eos/transcripts/[id] - Delete a transcript
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await deleteTranscript(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting transcript:', error)
    return NextResponse.json(
      { error: 'Failed to delete transcript' },
      { status: 500 }
    )
  }
}
