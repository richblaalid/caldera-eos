import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OAuthClient from 'intuit-oauth'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/agents/test/qbo
 * Debug endpoint to test QuickBooks token validity and data access.
 * Returns detailed diagnostics about the QBO connection.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { searchParams } = new URL(request.url)
    const partnerIdParam = searchParams.get('partner_id')

    const results: Record<string, unknown> = {
      environment: process.env.QUICKBOOKS_ENVIRONMENT || 'production (default)',
      client_id_prefix: process.env.QUICKBOOKS_CLIENT_ID?.substring(0, 12) + '...',
      client_secret_set: !!process.env.QUICKBOOKS_CLIENT_SECRET,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'https://caldera-eos.vercel.app'}/api/agents/auth/quickbooks/callback`,
    }

    // Fetch stored token
    const query = supabaseAdmin
      .from('partner_preferences')
      .select('partner_id, organization_id, quickbooks_refresh_token, quickbooks_realm_id')

    if (partnerIdParam) {
      query.eq('partner_id', partnerIdParam)
    } else {
      query.not('quickbooks_refresh_token', 'is', null)
    }

    const { data: prefs, error: prefsError } = await query.limit(1).single()

    if (prefsError || !prefs) {
      results.token_status = 'NO_TOKEN_FOUND'
      results.db_error = prefsError?.message
      return NextResponse.json(results)
    }

    results.partner_id = prefs.partner_id
    results.realm_id = prefs.quickbooks_realm_id
    results.token_prefix = prefs.quickbooks_refresh_token?.substring(0, 12) + '...'
    results.token_length = prefs.quickbooks_refresh_token?.length

    // Attempt token refresh
    try {
      const oauthClient = new OAuthClient({
        clientId: process.env.QUICKBOOKS_CLIENT_ID!,
        clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
        environment: (process.env.QUICKBOOKS_ENVIRONMENT || 'production') as 'sandbox' | 'production',
        redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'https://caldera-eos.vercel.app'}/api/agents/auth/quickbooks/callback`,
      })

      oauthClient.setToken({
        access_token: '',
        refresh_token: prefs.quickbooks_refresh_token!,
        realmId: prefs.quickbooks_realm_id!,
      })

      const tokenResponse = await oauthClient.refresh()
      const tokens = tokenResponse.getJson()

      results.token_refresh = 'SUCCESS'
      results.new_access_token_prefix = tokens.access_token?.substring(0, 12) + '...'
      results.new_refresh_token_changed = tokens.refresh_token !== prefs.quickbooks_refresh_token

      // Try a simple QBO API call - CompanyInfo
      const baseUrl = process.env.QUICKBOOKS_ENVIRONMENT === 'sandbox'
        ? 'https://sandbox-quickbooks.api.intuit.com'
        : 'https://quickbooks.api.intuit.com'

      const companyInfoUrl = `${baseUrl}/v3/company/${prefs.quickbooks_realm_id}/companyinfo/${prefs.quickbooks_realm_id}`
      const apiResponse = await fetch(companyInfoUrl, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: 'application/json',
        },
      })

      if (apiResponse.ok) {
        const companyData = await apiResponse.json()
        const info = companyData.CompanyInfo
        results.api_test = 'SUCCESS'
        results.company_name = info?.CompanyName
        results.company_country = info?.Country
      } else {
        const errorBody = await apiResponse.text()
        results.api_test = 'FAILED'
        results.api_status = apiResponse.status
        results.api_error = errorBody.substring(0, 500)
      }

      // Try a simple invoice count
      const countUrl = `${baseUrl}/v3/company/${prefs.quickbooks_realm_id}/query?query=${encodeURIComponent('SELECT COUNT(*) FROM Invoice')}`
      const countResponse = await fetch(countUrl, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: 'application/json',
        },
      })

      if (countResponse.ok) {
        const countData = await countResponse.json()
        results.invoice_count = countData.QueryResponse?.totalCount ?? 'unknown'
      }

      // Save rotated refresh token if changed
      if (tokens.refresh_token && tokens.refresh_token !== prefs.quickbooks_refresh_token) {
        await supabaseAdmin
          .from('partner_preferences')
          .update({ quickbooks_refresh_token: tokens.refresh_token })
          .eq('partner_id', prefs.partner_id)
          .eq('organization_id', prefs.organization_id)

        results.token_rotated = true
      }

    } catch (error: unknown) {
      const err = error as {
        message?: string
        authResponse?: { json?: unknown; response?: { status?: number; statusText?: string; body?: string } }
        originalMessage?: string
        intuit_tid?: string
      }
      results.token_refresh = 'FAILED'
      results.error_message = err.message
      results.error_original = err.originalMessage
      results.error_intuit_tid = err.intuit_tid
      results.error_auth_response = err.authResponse?.json
      results.error_status = err.authResponse?.response?.status
      results.error_body = err.authResponse?.response?.body
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('QBO test error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
