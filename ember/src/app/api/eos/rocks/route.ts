import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRocks, createRock } from '@/lib/eos'
import type { RockInsert } from '@/types/database'

// GET /api/eos/rocks - List all rocks with optional quarter filter
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const quarter = searchParams.get('quarter') || undefined
    const status = searchParams.get('status') || undefined

    let rocks = await getRocks(quarter)

    // Filter by status if provided
    if (status) {
      rocks = rocks.filter(rock => rock.status === status)
    }

    return NextResponse.json(rocks)
  } catch (error) {
    console.error('Error fetching rocks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rocks' },
      { status: 500 }
    )
  }
}

// POST /api/eos/rocks - Create a new rock
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    if (!body.quarter || typeof body.quarter !== 'string') {
      return NextResponse.json(
        { error: 'Quarter is required (e.g., "Q1 2025")' },
        { status: 400 }
      )
    }

    // Validate status if provided
    const validStatuses = ['on_track', 'off_track', 'at_risk', 'complete']
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const rockData: RockInsert = {
      title: body.title.trim(),
      description: body.description || null,
      owner_id: body.owner_id || null,
      quarter: body.quarter,
      status: body.status || 'on_track',
      milestones: body.milestones || [],
      notes: body.notes || null,
      due_date: body.due_date || null,
    }

    const rock = await createRock(rockData)

    return NextResponse.json(rock, { status: 201 })
  } catch (error) {
    console.error('Error creating rock:', error)
    return NextResponse.json(
      { error: 'Failed to create rock' },
      { status: 500 }
    )
  }
}
