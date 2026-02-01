import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/profiles - List profiles for the current user's organization
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the user's organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership) {
      // User not in any organization - return empty list
      return NextResponse.json([])
    }

    // Get all user IDs in the organization
    const { data: orgMembers, error: membersError } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', membership.organization_id)

    if (membersError) {
      console.error('Error fetching org members:', membersError)
      return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
    }

    if (!orgMembers || orgMembers.length === 0) {
      return NextResponse.json([])
    }

    // Get profiles for those users
    const userIds = orgMembers.map(m => m.user_id)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds)
      .order('name', { ascending: true })

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
    }

    return NextResponse.json(profiles || [])
  } catch (error) {
    console.error('Error fetching profiles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profiles' },
      { status: 500 }
    )
  }
}
