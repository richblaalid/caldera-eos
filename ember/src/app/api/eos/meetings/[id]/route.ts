import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMeeting, updateMeeting, deleteMeeting } from '@/lib/eos'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/eos/meetings/[id] - Get a single meeting
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const meeting = await getMeeting(id)
    return NextResponse.json(meeting)
  } catch (error) {
    console.error('Failed to fetch meeting:', error)
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  }
}

// PUT /api/eos/meetings/[id] - Update a meeting
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()

    const updates: Record<string, unknown> = {}
    if (body.title !== undefined) updates.title = body.title
    if (body.meeting_type !== undefined) updates.meeting_type = body.meeting_type
    if (body.meeting_date !== undefined) updates.meeting_date = body.meeting_date
    if (body.duration_minutes !== undefined) updates.duration_minutes = body.duration_minutes
    if (body.attendees !== undefined) updates.attendees = body.attendees
    if (body.agenda !== undefined) updates.agenda = body.agenda
    if (body.notes !== undefined) updates.notes = body.notes
    if (body.prep_content !== undefined) updates.prep_content = body.prep_content
    if (body.prep_generated_at !== undefined) updates.prep_generated_at = body.prep_generated_at

    const meeting = await updateMeeting(id, updates)
    return NextResponse.json(meeting)
  } catch (error) {
    console.error('Failed to update meeting:', error)
    return NextResponse.json({ error: 'Failed to update meeting' }, { status: 500 })
  }
}

// DELETE /api/eos/meetings/[id] - Delete a meeting
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    await deleteMeeting(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete meeting:', error)
    return NextResponse.json({ error: 'Failed to delete meeting' }, { status: 500 })
  }
}
