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

    // Debug: log full token response (no secrets, just structure)
    console.log('QBO OAuth token exchange result:', JSON.stringify({
      has_access_token: !!token.access_token,
      access_token_length: token.access_token?.length,
      has_refresh_token: !!token.refresh_token,
      refresh_token_length: token.refresh_token?.length,
      refresh_token_prefix: token.refresh_token?.substring(0, 12),
      token_type: token.token_type,
      expires_in: token.expires_in,
      x_refresh_token_expires_in: token.x_refresh_token_expires_in,
      all_keys: Object.keys(token),
    }))

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
    // Try UPDATE first (existing row), then INSERT if no row exists
    const serviceClient = await createServiceClient()
    const { data: updated, error: updateError } = await serviceClient
      .from('partner_preferences')
      .update({
        quickbooks_refresh_token: token.refresh_token,
        quickbooks_realm_id: realmId,
      })
      .eq('organization_id', membership.organization_id)
      .eq('partner_id', user.id)
      .select('id')

    if (updateError) {
      console.error('Failed to update QuickBooks tokens:', updateError)
      return NextResponse.redirect(
        new URL('/dashboard/settings/integrations?error=qb_save_failed', request.url)
      )
    }

    // No existing row — insert a new one
    if (!updated || updated.length === 0) {
      const { error: insertError } = await serviceClient
        .from('partner_preferences')
        .insert({
          organization_id: membership.organization_id,
          partner_id: user.id,
          quickbooks_refresh_token: token.refresh_token,
          quickbooks_realm_id: realmId,
        })

      if (insertError) {
        console.error('Failed to insert QuickBooks tokens:', insertError)
        return NextResponse.redirect(
          new URL('/dashboard/settings/integrations?error=qb_save_failed', request.url)
        )
      }
    }

    // Immediately validate: try refreshing the token we just saved
    try {
      const verifyClient = createQBOAuthClient()
      verifyClient.setToken({ access_token: '', refresh_token: token.refresh_token, realmId: realmId || '' })
      const verifyResponse = await verifyClient.refresh()
      const verifyTokens = verifyResponse.getJson()
      console.log('QBO token verification: SUCCESS', {
        new_refresh_token_changed: verifyTokens.refresh_token !== token.refresh_token,
      })
      // Save the rotated refresh token from verification
      if (verifyTokens.refresh_token && verifyTokens.refresh_token !== token.refresh_token) {
        await serviceClient
          .from('partner_preferences')
          .update({ quickbooks_refresh_token: verifyTokens.refresh_token })
          .eq('organization_id', membership.organization_id)
          .eq('partner_id', user.id)
        console.log('QBO: saved rotated refresh token from verification')
      }
    } catch (verifyError: unknown) {
      const vErr = verifyError as { message?: string }
      console.error('QBO token verification FAILED immediately after save:', vErr.message)
      // Still redirect as connected — token was saved, but log the warning
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
