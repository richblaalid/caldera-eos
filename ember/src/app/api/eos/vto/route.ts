import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { VTO, VTOInsert } from '@/types/database'

// Helper to get user's organization ID
async function getUserOrganizationId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  // First check if user is already a member of an org
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .limit(1)
    .single()

  if (membership?.organization_id) {
    return membership.organization_id
  }

  // Check allowed_emails and auto-assign
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null

  const { data: allowed } = await supabase
    .from('allowed_emails')
    .select('organization_id')
    .eq('email', user.email)
    .eq('auto_assign', true)
    .single()

  if (allowed?.organization_id) {
    // Auto-assign user to organization
    await supabase
      .from('organization_members')
      .insert({
        organization_id: allowed.organization_id,
        user_id: user.id,
        role: 'member',
      })
      .select()
      .single()

    return allowed.organization_id
  }

  return null
}

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
      // Create new V/TO with organization
      const orgId = await getUserOrganizationId(supabase)
      const { data, error } = await supabase
        .from('vto')
        .insert({
          ...body,
          version: 1,
          ...(orgId && { organization_id: orgId }),
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
