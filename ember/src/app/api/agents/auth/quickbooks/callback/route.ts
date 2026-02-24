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

    // Immediately validate the token via direct HTTP refresh
    // (intuit-oauth library has a url.parse bug, so we bypass it here too)
    try {
      const clientId = process.env.QUICKBOOKS_CLIENT_ID!
      const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET!
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token,
      })

      const verifyResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: body.toString(),
      })

      const verifyData = await verifyResponse.json()

      if (verifyResponse.ok && verifyData.refresh_token && verifyData.refresh_token !== token.refresh_token) {
        // Save the rotated refresh token
        await serviceClient
          .from('partner_preferences')
          .update({ quickbooks_refresh_token: verifyData.refresh_token })
          .eq('organization_id', membership.organization_id)
          .eq('partner_id', user.id)
      }
    } catch (verifyError: unknown) {
      const vErr = verifyError as { message?: string }
      console.error('QBO token verification failed after save:', vErr.message)
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
