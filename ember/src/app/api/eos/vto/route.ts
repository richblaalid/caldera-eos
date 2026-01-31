import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { VTO, VTOInsert } from '@/types/database'

// GET /api/eos/vto - Retrieve current V/TO
export async function GET() {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the latest V/TO (highest version)
    const { data, error } = await supabase
      .from('vto')
      .select('*')
      .order('version', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching V/TO:', error)
      return NextResponse.json({ error: 'Failed to fetch V/TO' }, { status: 500 })
    }

    // If no V/TO exists, return empty with 404
    if (!data) {
      return NextResponse.json({ error: 'V/TO not found' }, { status: 404 })
    }

    return NextResponse.json(data as VTO)
  } catch (error) {
    console.error('V/TO GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/eos/vto - Update V/TO (creates new version)
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json() as VTOInsert

    // Get existing V/TO to determine version
    const { data: existing } = await supabase
      .from('vto')
      .select('id, version')
      .order('version', { ascending: false })
      .limit(1)
      .single()

    let result
    if (existing) {
      // Update existing V/TO with incremented version
      const { data, error } = await supabase
        .from('vto')
        .update({
          ...body,
          version: existing.version + 1,
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating V/TO:', error)
        return NextResponse.json({ error: 'Failed to update V/TO' }, { status: 500 })
      }
      result = data
    } else {
      // Create new V/TO
      const { data, error } = await supabase
        .from('vto')
        .insert({
          ...body,
          version: 1,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating V/TO:', error)
        return NextResponse.json({ error: 'Failed to create V/TO' }, { status: 500 })
      }
      result = data
    }

    return NextResponse.json(result as VTO)
  } catch (error) {
    console.error('V/TO PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/eos/vto - Create initial V/TO (alias for PUT when none exists)
export async function POST(request: Request) {
  return PUT(request)
}
