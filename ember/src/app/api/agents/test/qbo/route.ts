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
 * Tests both the intuit-oauth library AND a direct HTTP refresh call.
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

    // ===== TEST 1: intuit-oauth library refresh =====
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
      results.library_refresh = 'SUCCESS'
      results.library_access_token_length = tokens.access_token?.length
    } catch (error: unknown) {
      const err = error as { message?: string }
      results.library_refresh = 'FAILED'
      results.library_error = err.message
    }

    // ===== TEST 2: Direct HTTP refresh (bypass intuit-oauth library) =====
    try {
      const clientId = process.env.QUICKBOOKS_CLIENT_ID!
      const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET!
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: prefs.quickbooks_refresh_token!,
      })

      const directResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: body.toString(),
      })

      const directData = await directResponse.json()

      if (directResponse.ok && directData.access_token) {
        results.direct_refresh = 'SUCCESS'
        results.direct_access_token_length = directData.access_token?.length
        results.direct_refresh_token_changed = directData.refresh_token !== prefs.quickbooks_refresh_token
        results.direct_expires_in = directData.expires_in

        // If direct worked, try a QBO API call
        const baseUrl = process.env.QUICKBOOKS_ENVIRONMENT === 'sandbox'
          ? 'https://sandbox-quickbooks.api.intuit.com'
          : 'https://quickbooks.api.intuit.com'

        const companyInfoUrl = `${baseUrl}/v3/company/${prefs.quickbooks_realm_id}/companyinfo/${prefs.quickbooks_realm_id}`
        const apiResponse = await fetch(companyInfoUrl, {
          headers: {
            Authorization: `Bearer ${directData.access_token}`,
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

        // Try invoice count
        const countUrl = `${baseUrl}/v3/company/${prefs.quickbooks_realm_id}/query?query=${encodeURIComponent('SELECT COUNT(*) FROM Invoice')}`
        const countResponse = await fetch(countUrl, {
          headers: {
            Authorization: `Bearer ${directData.access_token}`,
            Accept: 'application/json',
          },
        })

        if (countResponse.ok) {
          const countData = await countResponse.json()
          results.invoice_count = countData.QueryResponse?.totalCount ?? 'unknown'
        }

        // Save the new refresh token
        if (directData.refresh_token) {
          await supabaseAdmin
            .from('partner_preferences')
            .update({ quickbooks_refresh_token: directData.refresh_token })
            .eq('partner_id', prefs.partner_id)
            .eq('organization_id', prefs.organization_id)
          results.token_saved = true
        }
      } else {
        results.direct_refresh = 'FAILED'
        results.direct_status = directResponse.status
        results.direct_error = directData
      }
    } catch (error: unknown) {
      const err = error as { message?: string }
      results.direct_refresh = 'ERROR'
      results.direct_error = err.message
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('QBO test error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
