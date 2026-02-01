import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getCheckupPeriods,
  getActivePeriod,
  createCheckupPeriod,
  updateCheckupPeriod,
  getUserOrganizationId,
} from '@/lib/eos/checkup'
import type { CheckupPeriodInsert } from '@/types/database'

// GET /api/eos/checkup/periods - List all periods or get active
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'

    if (activeOnly) {
      const period = await getActivePeriod()
      return NextResponse.json(period)
    }

    const periods = await getCheckupPeriods()
    return NextResponse.json(periods)
  } catch (error) {
    console.error('Checkup periods GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/eos/checkup/periods - Create a new period
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Get user's organization
    const orgId = await getUserOrganizationId()
    if (!orgId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const periodData: CheckupPeriodInsert = {
      organization_id: orgId,
      name: body.name,
      start_date: body.start_date,
      end_date: body.end_date,
      is_active: body.is_active ?? false,
    }

    const period = await createCheckupPeriod(periodData)
    return NextResponse.json(period, { status: 201 })
  } catch (error) {
    console.error('Checkup periods POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/eos/checkup/periods - Update a period
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Period ID is required' }, { status: 400 })
    }

    const period = await updateCheckupPeriod(id, updates)
    return NextResponse.json(period)
  } catch (error) {
    console.error('Checkup periods PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
