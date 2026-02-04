import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAllMetricEntries, getMetricEntries, upsertMetricEntry } from '@/lib/eos'
import type { ScorecardEntryInsert } from '@/types/database'

// GET /api/eos/scorecard/entries - Get entries for a date range or specific metric
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const metricId = searchParams.get('metric_id')
    const limit = searchParams.get('limit')
    const weekStart = searchParams.get('week_start')
    const weekEnd = searchParams.get('week_end')

    // If metric_id is provided, get entries for that specific metric
    if (metricId) {
      const entries = await getMetricEntries(metricId, limit ? parseInt(limit, 10) : undefined)
      return NextResponse.json(entries)
    }

    // Otherwise, require week range for grid view
    if (!weekStart || !weekEnd) {
      return NextResponse.json(
        { error: 'Either metric_id or both week_start and week_end are required' },
        { status: 400 }
      )
    }

    const entries = await getAllMetricEntries(weekStart, weekEnd)
    return NextResponse.json(entries)
  } catch (error) {
    console.error('Error fetching entries:', error)
    return NextResponse.json(
      { error: 'Failed to fetch entries' },
      { status: 500 }
    )
  }
}

// POST /api/eos/scorecard/entries - Create or update an entry
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.metric_id) {
      return NextResponse.json(
        { error: 'metric_id is required' },
        { status: 400 }
      )
    }

    if (!body.week_of) {
      return NextResponse.json(
        { error: 'week_of is required (YYYY-MM-DD format)' },
        { status: 400 }
      )
    }

    const entryData: ScorecardEntryInsert = {
      metric_id: body.metric_id,
      week_of: body.week_of,
      value: body.value ?? null,
      notes: body.notes || null,
    }

    const entry = await upsertMetricEntry(entryData)

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error('Error upserting entry:', error)
    return NextResponse.json(
      { error: 'Failed to save entry' },
      { status: 500 }
    )
  }
}

// PUT /api/eos/scorecard/entries - Batch update entries
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!Array.isArray(body.entries)) {
      return NextResponse.json(
        { error: 'entries array is required' },
        { status: 400 }
      )
    }

    const results = await Promise.all(
      body.entries.map((entry: ScorecardEntryInsert) =>
        upsertMetricEntry({
          metric_id: entry.metric_id,
          week_of: entry.week_of,
          value: entry.value ?? null,
          notes: entry.notes || null,
        })
      )
    )

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error batch updating entries:', error)
    return NextResponse.json(
      { error: 'Failed to save entries' },
      { status: 500 }
    )
  }
}
