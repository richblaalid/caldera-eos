import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRock, updateRock, deleteRock } from '@/lib/eos'
import type { RockInsert, RockStatus } from '@/types/database'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/eos/rocks/[id] - Get a single rock
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const rock = await getRock(id)

    return NextResponse.json(rock)
  } catch (error) {
    console.error('Error fetching rock:', error)
    return NextResponse.json(
      { error: 'Rock not found' },
      { status: 404 }
    )
  }
}

// PUT /api/eos/rocks/[id] - Update a rock
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Validate status if provided
    const validStatuses: RockStatus[] = ['on_track', 'off_track', 'at_risk', 'complete']
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Build updates object with only provided fields
    const updates: Partial<RockInsert> = {}

    if (body.title !== undefined) updates.title = body.title.trim()
    if (body.description !== undefined) updates.description = body.description
    if (body.owner_id !== undefined) updates.owner_id = body.owner_id
    if (body.quarter !== undefined) updates.quarter = body.quarter
    if (body.status !== undefined) {
      updates.status = body.status
      // Set completed_at when marking complete
      if (body.status === 'complete') {
        updates.completed_at = new Date().toISOString()
      } else if (updates.completed_at === undefined) {
        // Clear completed_at when changing from complete to another status
        const existingRock = await getRock(id)
        if (existingRock.status === 'complete') {
          updates.completed_at = null
        }
      }
    }
    if (body.milestones !== undefined) updates.milestones = body.milestones
    if (body.notes !== undefined) updates.notes = body.notes
    if (body.due_date !== undefined) updates.due_date = body.due_date

    const rock = await updateRock(id, updates)

    return NextResponse.json(rock)
  } catch (error) {
    console.error('Error updating rock:', error)
    return NextResponse.json(
      { error: 'Failed to update rock' },
      { status: 500 }
    )
  }
}

// DELETE /api/eos/rocks/[id] - Delete a rock
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await deleteRock(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting rock:', error)
    return NextResponse.json(
      { error: 'Failed to delete rock' },
      { status: 500 }
    )
  }
}
