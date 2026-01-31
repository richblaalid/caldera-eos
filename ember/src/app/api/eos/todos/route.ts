import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTodos, createTodo } from '@/lib/eos'
import type { TodoInsert } from '@/types/database'

// GET /api/eos/todos - List all todos with optional filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ownerId = searchParams.get('owner_id') || undefined
    const completedParam = searchParams.get('completed')
    const completed = completedParam === 'true' ? true : completedParam === 'false' ? false : undefined

    const todos = await getTodos({ owner_id: ownerId, completed })
    return NextResponse.json(todos)
  } catch (error) {
    console.error('Error fetching todos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch todos' },
      { status: 500 }
    )
  }
}

// POST /api/eos/todos - Create a new todo
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

    const todoData: TodoInsert = {
      title: body.title.trim(),
      description: body.description || null,
      owner_id: body.owner_id || null,
      due_date: body.due_date || null,
      completed: body.completed ?? false,
      meeting_id: body.meeting_id || null,
      rock_id: body.rock_id || null,
      issue_id: body.issue_id || null,
    }

    const todo = await createTodo(todoData)

    return NextResponse.json(todo, { status: 201 })
  } catch (error) {
    console.error('Error creating todo:', error)
    return NextResponse.json(
      { error: 'Failed to create todo' },
      { status: 500 }
    )
  }
}
