import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMetric, updateMetric, deleteMetric } from '@/lib/eos'
import type { ScorecardMetricInsert, GoalDirection, MetricFrequency } from '@/types/database'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/eos/scorecard/metrics/[id] - Get a single metric
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const metric = await getMetric(id)

    return NextResponse.json(metric)
  } catch (error) {
    console.error('Error fetching metric:', error)
    return NextResponse.json(
      { error: 'Metric not found' },
      { status: 404 }
    )
  }
}

// PUT /api/eos/scorecard/metrics/[id] - Update a metric
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Validate goal_direction if provided
    const validDirections: GoalDirection[] = ['above', 'below', 'equal']
    if (body.goal_direction && !validDirections.includes(body.goal_direction)) {
      return NextResponse.json(
        { error: `Invalid goal_direction. Must be one of: ${validDirections.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate frequency if provided
    const validFrequencies: MetricFrequency[] = ['weekly', 'monthly']
    if (body.frequency && !validFrequencies.includes(body.frequency)) {
      return NextResponse.json(
        { error: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}` },
        { status: 400 }
      )
    }

    // Build updates object with only provided fields
    const updates: Partial<ScorecardMetricInsert> = {}

    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.description !== undefined) updates.description = body.description
    if (body.owner_id !== undefined) updates.owner_id = body.owner_id
    if (body.target !== undefined) updates.target = body.target
    if (body.unit !== undefined) updates.unit = body.unit
    if (body.frequency !== undefined) updates.frequency = body.frequency
    if (body.goal_direction !== undefined) updates.goal_direction = body.goal_direction
    if (body.display_order !== undefined) updates.display_order = body.display_order
    if (body.is_active !== undefined) updates.is_active = body.is_active

    const metric = await updateMetric(id, updates)

    return NextResponse.json(metric)
  } catch (error) {
    console.error('Error updating metric:', error)
    return NextResponse.json(
      { error: 'Failed to update metric' },
      { status: 500 }
    )
  }
}

// DELETE /api/eos/scorecard/metrics/[id] - Soft delete a metric
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await deleteMetric(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting metric:', error)
    return NextResponse.json(
      { error: 'Failed to delete metric' },
      { status: 500 }
    )
  }
}
