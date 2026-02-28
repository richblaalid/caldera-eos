import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const GRAIN_TOKEN_URL = 'https://api.grain.com/_/public-api/oauth2/token'

// GET /api/agents/auth/grain/callback - Exchange code for tokens, store refresh token
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
      console.error('Grain OAuth denied:', error)
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?error=grain_denied', request.url)
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?error=grain_no_code', request.url)
      )
    }

    // Verify state
    let stateData: { userId: string; nonce: string }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
    } catch {
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?error=grain_invalid_state', request.url)
      )
    }

    if (stateData.userId !== user.id) {
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?error=grain_state_mismatch', request.url)
      )
    }

    // Get PKCE verifier from cookie
    const cookieStore = await cookies()
    const codeVerifier = cookieStore.get('grain_pkce_verifier')?.value
    if (!codeVerifier) {
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?error=grain_no_verifier', request.url)
      )
    }

    // Exchange code for tokens
    const clientId = process.env.GRAIN_MCP_CLIENT_ID!
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'https://caldera-eos.vercel.app'}/api/agents/auth/grain/callback`

    const tokenResponse = await fetch(GRAIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: codeVerifier,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Grain token exchange failed:', tokenResponse.status, errorText)
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?error=grain_token_exchange', request.url)
      )
    }

    const tokenData = await tokenResponse.json() as {
      access_token: string
      refresh_token?: string
      expires_in?: number
      token_type?: string
    }

    if (!tokenData.refresh_token) {
      console.warn('Grain did not return a refresh token — storing access token only')
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
        new URL('/dashboard/settings/integrations?error=no_org', request.url)
      )
    }

    // Store tokens in partner_preferences (use raw admin client to bypass RLS)
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { error: upsertError } = await adminClient
      .from('partner_preferences')
      .upsert({
        organization_id: membership.organization_id,
        partner_id: user.id,
        grain_refresh_token: tokenData.refresh_token || tokenData.access_token,
        grain_client_id: clientId,
      }, {
        onConflict: 'organization_id,partner_id',
      })

    if (upsertError) {
      console.error('Failed to save Grain tokens:', upsertError)
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?error=grain_save_failed', request.url)
      )
    }

    // Clear the PKCE cookie
    cookieStore.delete('grain_pkce_verifier')

    return NextResponse.redirect(
      new URL('/dashboard/settings/integrations?success=grain_connected', request.url)
    )
  } catch (error) {
    console.error('Grain OAuth callback error:', error)
    return NextResponse.redirect(
      new URL('/dashboard/settings/integrations?error=grain_unknown', request.url)
    )
  }
}
