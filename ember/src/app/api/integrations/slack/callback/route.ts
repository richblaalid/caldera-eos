import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForToken, testConnection } from '@/lib/slack'

// GET /api/integrations/slack/callback - Handle Slack OAuth callback
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle user denial
    if (error) {
      console.error('Slack OAuth denied:', error)
      return NextResponse.redirect(
        new URL('/dashboard/settings/slack?error=denied', request.url)
      )
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/dashboard/settings/slack?error=no_code', request.url)
      )
    }

    // Verify state (CSRF protection)
    const cookies = request.headers.get('cookie') || ''
    const stateCookie = cookies
      .split(';')
      .find(c => c.trim().startsWith('slack_oauth_state='))
      ?.split('=')[1]

    if (!stateCookie || stateCookie !== state) {
      console.error('Slack OAuth state mismatch')
      return NextResponse.redirect(
        new URL('/dashboard/settings/slack?error=invalid_state', request.url)
      )
    }

    // Exchange code for token
    const tokenResponse = await exchangeCodeForToken(code)

    if (!tokenResponse.ok || !tokenResponse.access_token) {
      console.error('Slack token exchange failed:', tokenResponse.error)
      return NextResponse.redirect(
        new URL('/dashboard/settings/slack?error=token_failed', request.url)
      )
    }

    // Test the connection
    const testResult = await testConnection(tokenResponse.access_token)
    if (!testResult.ok) {
      console.error('Slack connection test failed:', testResult.error)
      return NextResponse.redirect(
        new URL('/dashboard/settings/slack?error=connection_failed', request.url)
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
        new URL('/dashboard/settings/slack?error=no_org', request.url)
      )
    }

    // Save or update Slack settings
    const { error: upsertError } = await supabase
      .from('slack_settings')
      .upsert({
        organization_id: membership.organization_id,
        bot_token: tokenResponse.access_token,
        is_active: true,
      }, {
        onConflict: 'organization_id',
      })

    if (upsertError) {
      console.error('Failed to save Slack settings:', upsertError)
      return NextResponse.redirect(
        new URL('/dashboard/settings/slack?error=save_failed', request.url)
      )
    }

    // Clear state cookie and redirect to settings
    const response = NextResponse.redirect(
      new URL('/dashboard/settings/slack?success=connected', request.url)
    )
    response.cookies.delete('slack_oauth_state')

    return response
  } catch (error) {
    console.error('Slack OAuth callback error:', error)
    return NextResponse.redirect(
      new URL('/dashboard/settings/slack?error=unknown', request.url)
    )
  }
}
