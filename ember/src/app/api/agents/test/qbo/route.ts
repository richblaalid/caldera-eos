import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/agents/test/qbo
 * Test endpoint to verify QuickBooks connection, token validity, and data access.
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
      results.status = 'NOT_CONNECTED'
      results.db_error = prefsError?.message
      return NextResponse.json(results)
    }

    results.partner_id = prefs.partner_id
    results.realm_id = prefs.quickbooks_realm_id

    // Refresh the token via direct HTTP
    const clientId = process.env.QUICKBOOKS_CLIENT_ID!
    const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET!
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: prefs.quickbooks_refresh_token!,
    })

    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok || !tokenData.access_token) {
      results.status = 'TOKEN_REFRESH_FAILED'
      results.error = tokenData.error_description || tokenData.error
      return NextResponse.json(results)
    }

    results.token_refresh = 'SUCCESS'

    // Test QBO API - CompanyInfo
    const baseUrl = process.env.QUICKBOOKS_ENVIRONMENT === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com'

    const companyInfoUrl = `${baseUrl}/v3/company/${prefs.quickbooks_realm_id}/companyinfo/${prefs.quickbooks_realm_id}`
    const apiResponse = await fetch(companyInfoUrl, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/json',
      },
    })

    if (apiResponse.ok) {
      const companyData = await apiResponse.json()
      results.api_test = 'SUCCESS'
      results.company_name = companyData.CompanyInfo?.CompanyName
    } else {
      results.api_test = 'FAILED'
      results.api_status = apiResponse.status
    }

    // Invoice count
    const countUrl = `${baseUrl}/v3/company/${prefs.quickbooks_realm_id}/query?query=${encodeURIComponent('SELECT COUNT(*) FROM Invoice')}`
    const countResponse = await fetch(countUrl, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/json',
      },
    })

    if (countResponse.ok) {
      const countData = await countResponse.json()
      results.invoice_count = countData.QueryResponse?.totalCount ?? 'unknown'
    }

    // Save rotated refresh token if changed
    if (tokenData.refresh_token && tokenData.refresh_token !== prefs.quickbooks_refresh_token) {
      await supabaseAdmin
        .from('partner_preferences')
        .update({ quickbooks_refresh_token: tokenData.refresh_token })
        .eq('partner_id', prefs.partner_id)
        .eq('organization_id', prefs.organization_id)
      results.token_rotated = true
    }

    results.status = 'HEALTHY'
    return NextResponse.json(results)
  } catch (error) {
    console.error('QBO test error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
