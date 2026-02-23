import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Client } from '@hubspot/api-client'

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID!
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://caldera-eos.vercel.app'
const REDIRECT_URI = `${APP_URL}/api/agents/auth/hubspot/callback`

// GET /api/agents/auth/hubspot/callback - Exchange code for tokens
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const url = new URL(request.url)
    const error = url.searchParams.get('error')

    if (error) {
      console.error('HubSpot OAuth denied:', error)
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=hubspot_denied', request.url)
      )
    }

    // Verify state
    const state = url.searchParams.get('state')
    if (!state) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=hubspot_no_state', request.url)
      )
    }

    let stateData: { userId: string; nonce: string }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
    } catch {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=hubspot_invalid_state', request.url)
      )
    }

    if (stateData.userId !== user.id) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=hubspot_state_mismatch', request.url)
      )
    }

    // Exchange code for tokens
    const code = url.searchParams.get('code')
    if (!code) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=hubspot_no_code', request.url)
      )
    }

    const hubspotClient = new Client()
    const tokenResponse = await hubspotClient.oauth.tokensApi.create(
      'authorization_code',
      code,
      REDIRECT_URI,
      HUBSPOT_CLIENT_ID,
      HUBSPOT_CLIENT_SECRET
    )

    if (!tokenResponse.refreshToken) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=hubspot_no_refresh_token', request.url)
      )
    }

    // Get portal ID (hub ID) from access token info
    const accessTokenInfo = await hubspotClient.oauth.accessTokensApi.get(tokenResponse.accessToken)
    const portalId = String(accessTokenInfo.hubId)

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

    // Store tokens in partner_preferences
    const serviceClient = await createServiceClient()
    const { error: upsertError } = await serviceClient
      .from('partner_preferences')
      .upsert({
        organization_id: membership.organization_id,
        partner_id: user.id,
        hubspot_refresh_token: tokenResponse.refreshToken,
        hubspot_portal_id: portalId,
      }, {
        onConflict: 'organization_id,partner_id',
      })

    if (upsertError) {
      console.error('Failed to save HubSpot tokens:', upsertError)
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=hubspot_save_failed', request.url)
      )
    }

    return NextResponse.redirect(
      new URL('/dashboard/settings?success=hubspot_connected', request.url)
    )
  } catch (error) {
    console.error('HubSpot OAuth callback error:', error)
    return NextResponse.redirect(
      new URL('/dashboard/settings?error=hubspot_unknown', request.url)
    )
  }
}
