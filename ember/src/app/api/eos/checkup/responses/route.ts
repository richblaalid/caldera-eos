import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserResponses, upsertResponses } from '@/lib/eos/checkup'
import type { CheckupResponseInsert } from '@/types/database'

// GET /api/eos/checkup/responses?periodId=xxx - Get user's responses for a period
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const periodId = searchParams.get('periodId')

    if (!periodId) {
      return NextResponse.json({ error: 'periodId is required' }, { status: 400 })
    }

    const responses = await getUserResponses(periodId, user.id)
    return NextResponse.json(responses)
  } catch (error) {
    console.error('Checkup responses GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/eos/checkup/responses - Upsert responses (batch)
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { periodId, responses } = body as {
      periodId: string
      responses: Array<{ question_id: string; score: number; notes?: string }>
    }

    if (!periodId || !responses || !Array.isArray(responses)) {
      return NextResponse.json(
        { error: 'periodId and responses array are required' },
        { status: 400 }
      )
    }

    // Build response inserts with user ID
    const responseInserts: CheckupResponseInsert[] = responses.map(r => ({
      period_id: periodId,
      user_id: user.id,
      question_id: r.question_id,
      score: r.score,
      notes: r.notes || null,
    }))

    const updatedResponses = await upsertResponses(responseInserts)
    return NextResponse.json(updatedResponses)
  } catch (error) {
    console.error('Checkup responses PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
