import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPeriodStats, getHistoricalScores } from '@/lib/eos/checkup'

// GET /api/eos/checkup/stats?periodId=xxx - Get stats for a period or historical
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
    const historical = searchParams.get('historical') === 'true'

    if (historical) {
      const history = await getHistoricalScores()
      return NextResponse.json(history)
    }

    if (!periodId) {
      return NextResponse.json({ error: 'periodId is required' }, { status: 400 })
    }

    const stats = await getPeriodStats(periodId)
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Checkup stats GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
