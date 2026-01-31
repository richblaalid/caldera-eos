import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTodo, updateTodo, deleteTodo, toggleTodo } from '@/lib/eos'
import type { TodoInsert } from '@/types/database'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/eos/todos/[id] - Get a single todo
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const todo = await getTodo(id)

    return NextResponse.json(todo)
  } catch (error) {
    console.error('Error fetching todo:', error)
    return NextResponse.json(
      { error: 'Todo not found' },
      { status: 404 }
    )
  }
}

// PUT /api/eos/todos/[id] - Update a todo
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Build updates object with only provided fields
    const updates: Partial<TodoInsert> = {}

    if (body.title !== undefined) updates.title = body.title.trim()
    if (body.description !== undefined) updates.description = body.description
    if (body.owner_id !== undefined) updates.owner_id = body.owner_id
    if (body.due_date !== undefined) updates.due_date = body.due_date
    if (body.completed !== undefined) {
      updates.completed = body.completed
      updates.completed_at = body.completed ? new Date().toISOString() : null
    }
    if (body.meeting_id !== undefined) updates.meeting_id = body.meeting_id
    if (body.rock_id !== undefined) updates.rock_id = body.rock_id
    if (body.issue_id !== undefined) updates.issue_id = body.issue_id

    const todo = await updateTodo(id, updates)

    return NextResponse.json(todo)
  } catch (error) {
    console.error('Error updating todo:', error)
    return NextResponse.json(
      { error: 'Failed to update todo' },
      { status: 500 }
    )
  }
}

// PATCH /api/eos/todos/[id] - Toggle todo completion
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const todo = await toggleTodo(id)

    return NextResponse.json(todo)
  } catch (error) {
    console.error('Error toggling todo:', error)
    return NextResponse.json(
      { error: 'Failed to toggle todo' },
      { status: 500 }
    )
  }
}

// DELETE /api/eos/todos/[id] - Delete a todo
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await deleteTodo(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting todo:', error)
    return NextResponse.json(
      { error: 'Failed to delete todo' },
      { status: 500 }
    )
  }
}
