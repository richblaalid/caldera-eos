import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Insight } from '@/types/database'

// GET /api/insights/suggestions - Get pending metric suggestions
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch unacknowledged suggestions that are metric recommendations
    const { data, error } = await supabase
      .from('insights')
      .select('*')
      .eq('type', 'suggestion')
      .like('title', 'Suggested Metric:%')
      .eq('acknowledged', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching suggestions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch suggestions' },
        { status: 500 }
      )
    }

    return NextResponse.json(data as Insight[])
  } catch (error) {
    console.error('Error in suggestions API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
