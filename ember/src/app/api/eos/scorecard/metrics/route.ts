import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMetrics, createMetric } from '@/lib/eos'
import type { ScorecardMetricInsert, GoalDirection, MetricFrequency } from '@/types/database'

// GET /api/eos/scorecard/metrics - List all active metrics
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const metrics = await getMetrics()
    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error fetching metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}

// POST /api/eos/scorecard/metrics - Create a new metric
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

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

    const metricData: ScorecardMetricInsert = {
      name: body.name.trim(),
      description: body.description || null,
      owner_id: body.owner_id || null,
      target: body.target ?? null,
      unit: body.unit || null,
      frequency: body.frequency || 'weekly',
      goal_direction: body.goal_direction || 'above',
      display_order: body.display_order,
      is_active: body.is_active ?? true,
    }

    const metric = await createMetric(metricData)

    return NextResponse.json(metric, { status: 201 })
  } catch (error) {
    console.error('Error creating metric:', error)
    return NextResponse.json(
      { error: 'Failed to create metric' },
      { status: 500 }
    )
  }
}
