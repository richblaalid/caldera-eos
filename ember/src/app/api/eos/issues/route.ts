import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getIssues, createIssue } from '@/lib/eos'
import type { IssueInsert, IssueStatus, IssueSource } from '@/types/database'

// GET /api/eos/issues - List all issues with optional filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined

    const issues = await getIssues(status)
    return NextResponse.json(issues)
  } catch (error) {
    console.error('Error fetching issues:', error)
    return NextResponse.json(
      { error: 'Failed to fetch issues' },
      { status: 500 }
    )
  }
}

// POST /api/eos/issues - Create a new issue
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

    // Validate status if provided
    const validStatuses: IssueStatus[] = ['open', 'identified', 'discussed', 'solved', 'dropped']
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate source if provided
    const validSources: IssueSource[] = ['manual', 'transcript', 'insight', 'chat']
    if (body.source && !validSources.includes(body.source)) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${validSources.join(', ')}` },
        { status: 400 }
      )
    }

    const issueData: IssueInsert = {
      title: body.title.trim(),
      description: body.description || null,
      priority: body.priority ?? 0,
      status: body.status || 'open',
      owner_id: body.owner_id || null,
      source: body.source || 'manual',
      source_id: body.source_id || null,
      resolution: body.resolution || null,
    }

    const issue = await createIssue(issueData)

    return NextResponse.json(issue, { status: 201 })
  } catch (error) {
    console.error('Error creating issue:', error)
    return NextResponse.json(
      { error: 'Failed to create issue' },
      { status: 500 }
    )
  }
}
