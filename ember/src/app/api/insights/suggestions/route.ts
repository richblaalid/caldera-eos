import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Insight } from '@/types/database'

const TITLE_PREFIXES: Record<string, string> = {
  metric: 'Suggested Metric:%',
  todo: 'Suggested Todo:%',
  issue: 'Suggested Issue:%',
}

// GET /api/insights/suggestions?type=metric|todo|issue&limit=15&offset=0
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const suggestionType = request.nextUrl.searchParams.get('type') || 'metric'
    const titlePrefix = TITLE_PREFIXES[suggestionType] || TITLE_PREFIXES.metric
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '10') || 10, 50)
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0') || 0

    // Get total count for pagination info
    const { count } = await supabase
      .from('insights')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'suggestion')
      .like('title', titlePrefix)
      .eq('acknowledged', false)

    // Fetch paginated results, sorted by priority (1=highest) then recency
    const { data, error } = await supabase
      .from('insights')
      .select('*')
      .eq('type', 'suggestion')
      .like('title', titlePrefix)
      .eq('acknowledged', false)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching suggestions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch suggestions' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      suggestions: data as Insight[],
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Error in suggestions API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
