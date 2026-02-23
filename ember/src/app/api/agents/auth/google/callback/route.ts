import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createGoogleOAuth2Client } from '@/lib/connectors/google-auth'

// GET /api/agents/auth/google/callback - Exchange code for tokens, store refresh token
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      console.error('Google OAuth denied:', error)
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=google_denied', request.url)
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=google_no_code', request.url)
      )
    }

    // Verify state
    let stateData: { userId: string; nonce: string }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
    } catch {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=google_invalid_state', request.url)
      )
    }

    if (stateData.userId !== user.id) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=google_state_mismatch', request.url)
      )
    }

    // Exchange code for tokens
    const oauth2Client = createGoogleOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      console.error('No refresh token received — user may need to re-consent')
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=google_no_refresh_token', request.url)
      )
    }

    // Get user's organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=no_org', request.url)
      )
    }

    // Store refresh token in partner_preferences using service role
    // (partner_preferences RLS restricts writes to the partner, but
    //  we need to upsert which may require insert)
    const serviceClient = await createServiceClient()
    const { error: upsertError } = await serviceClient
      .from('partner_preferences')
      .upsert({
        organization_id: membership.organization_id,
        partner_id: user.id,
        google_refresh_token: tokens.refresh_token,
      }, {
        onConflict: 'organization_id,partner_id',
      })

    if (upsertError) {
      console.error('Failed to save Google tokens:', upsertError)
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=google_save_failed', request.url)
      )
    }

    return NextResponse.redirect(
      new URL('/dashboard/settings?success=google_connected', request.url)
    )
  } catch (error) {
    console.error('Google OAuth callback error:', error)
    return NextResponse.redirect(
      new URL('/dashboard/settings?error=google_unknown', request.url)
    )
  }
}
