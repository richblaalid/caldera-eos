import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/insights/[id]/dismiss - Dismiss an insight
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

    // Mark insight as acknowledged (dismissed)
    const { data, error } = await supabase
      .from('insights')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user.id,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error dismissing insight:', error)
      return NextResponse.json(
        { error: 'Failed to dismiss insight' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in dismiss API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
