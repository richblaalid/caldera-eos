import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getCompletion,
  getPeriodCompletions,
  submitCheckup,
} from '@/lib/eos/checkup'

// GET /api/eos/checkup/completions?periodId=xxx - Get completions for a period
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
    const userOnly = searchParams.get('userOnly') === 'true'

    if (!periodId) {
      return NextResponse.json({ error: 'periodId is required' }, { status: 400 })
    }

    if (userOnly) {
      const completion = await getCompletion(periodId, user.id)
      return NextResponse.json(completion)
    }

    const completions = await getPeriodCompletions(periodId)
    return NextResponse.json(completions)
  } catch (error) {
    console.error('Checkup completions GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/eos/checkup/completions - Submit/complete the assessment
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { periodId } = body as { periodId: string }

    if (!periodId) {
      return NextResponse.json({ error: 'periodId is required' }, { status: 400 })
    }

    const completion = await submitCheckup(periodId, user.id)
    return NextResponse.json(completion, { status: 201 })
  } catch (error) {
    console.error('Checkup completions POST error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
