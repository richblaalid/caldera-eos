import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getIssue, updateIssue, deleteIssue } from '@/lib/eos'
import type { IssueInsert, IssueStatus } from '@/types/database'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/eos/issues/[id] - Get a single issue
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const issue = await getIssue(id)

    return NextResponse.json(issue)
  } catch (error) {
    console.error('Error fetching issue:', error)
    return NextResponse.json(
      { error: 'Issue not found' },
      { status: 404 }
    )
  }
}

// PUT /api/eos/issues/[id] - Update an issue
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
    const validStatuses: IssueStatus[] = ['open', 'identified', 'discussed', 'solved', 'dropped']
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Build updates object with only provided fields
    const updates: Partial<IssueInsert> = {}

    if (body.title !== undefined) updates.title = body.title.trim()
    if (body.description !== undefined) updates.description = body.description
    if (body.priority !== undefined) updates.priority = body.priority
    if (body.status !== undefined) updates.status = body.status
    if (body.owner_id !== undefined) updates.owner_id = body.owner_id
    if (body.resolution !== undefined) updates.resolution = body.resolution

    const issue = await updateIssue(id, updates)

    return NextResponse.json(issue)
  } catch (error) {
    console.error('Error updating issue:', error)
    return NextResponse.json(
      { error: 'Failed to update issue' },
      { status: 500 }
    )
  }
}

// DELETE /api/eos/issues/[id] - Delete an issue
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await deleteIssue(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting issue:', error)
    return NextResponse.json(
      { error: 'Failed to delete issue' },
      { status: 500 }
    )
  }
}
