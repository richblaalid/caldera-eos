import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMeetings, createMeeting } from '@/lib/eos'
import type { MeetingInsert } from '@/types/database'

// GET /api/eos/meetings - List all meetings
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const meetingType = searchParams.get('type') || undefined

    const meetings = await getMeetings(meetingType)
    return NextResponse.json(meetings)
  } catch (error) {
    console.error('Failed to fetch meetings:', error)
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 })
  }
}

// POST /api/eos/meetings - Create a new meeting
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    if (!body.meeting_date) {
      return NextResponse.json({ error: 'Meeting date is required' }, { status: 400 })
    }

    const meetingData: MeetingInsert = {
      title: body.title.trim(),
      meeting_type: body.meeting_type || 'l10',
      meeting_date: body.meeting_date,
      duration_minutes: body.duration_minutes || null,
      attendees: body.attendees || [],
      agenda: body.agenda || [],
      notes: body.notes || null,
    }

    const meeting = await createMeeting(meetingData)
    return NextResponse.json(meeting, { status: 201 })
  } catch (error) {
    console.error('Failed to create meeting:', error)
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 })
  }
}
