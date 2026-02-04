import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseMetricSuggestion } from '@/lib/metric-suggestions'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/insights/[id]/accept-metric - Get metric data for pre-populating form
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Fetch the insight
    const { data: insight, error } = await supabase
      .from('insights')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !insight) {
      return NextResponse.json(
        { error: 'Insight not found' },
        { status: 404 }
      )
    }

    // Parse the metric data from insight content
    const metricData = parseMetricSuggestion(insight.content)
    if (!metricData) {
      return NextResponse.json(
        { error: 'Could not parse metric data from insight' },
        { status: 400 }
      )
    }

    // Return the metric data for form pre-population
    return NextResponse.json({
      insightId: id,
      metric: {
        name: metricData.name,
        description: metricData.description || '',
        target: metricData.suggested_target || '',
        owner: metricData.owner || '',
        frequency: metricData.frequency || 'weekly',
      },
    })
  } catch (error) {
    console.error('Error in accept-metric API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
