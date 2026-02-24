import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createQBOAuthClient } from '../route'

// GET /api/agents/auth/quickbooks/callback - Exchange code for tokens
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
      console.error('QuickBooks OAuth denied:', error)
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?error=qb_denied', request.url)
      )
    }

    // Verify state
    const state = url.searchParams.get('state')
    if (!state) {
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?error=qb_no_state', request.url)
      )
    }

    let stateData: { userId: string; nonce: string }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
    } catch {
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?error=qb_invalid_state', request.url)
      )
    }

    if (stateData.userId !== user.id) {
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?error=qb_state_mismatch', request.url)
      )
    }

    // Exchange code for tokens
    const oauthClient = createQBOAuthClient()
    const authResponse = await oauthClient.createToken(url.toString())
    const token = authResponse.getJson()

    if (!token.refresh_token) {
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?error=qb_no_refresh_token', request.url)
      )
    }

    // Get realmId (company ID) from the URL params
    const realmId = url.searchParams.get('realmId')

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

    // Store tokens in partner_preferences
    const serviceClient = await createServiceClient()
    const { error: upsertError } = await serviceClient
      .from('partner_preferences')
      .upsert({
        organization_id: membership.organization_id,
        partner_id: user.id,
        quickbooks_refresh_token: token.refresh_token,
        quickbooks_realm_id: realmId,
      }, {
        onConflict: 'organization_id,partner_id',
      })

    if (upsertError) {
      console.error('Failed to save QuickBooks tokens:', upsertError)
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?error=qb_save_failed', request.url)
      )
    }

    return NextResponse.redirect(
      new URL('/dashboard/settings/integrations?success=quickbooks_connected', request.url)
    )
  } catch (error) {
    console.error('QuickBooks OAuth callback error:', error)
    return NextResponse.redirect(
      new URL('/dashboard/settings/integrations?error=qb_unknown', request.url)
    )
  }
}
