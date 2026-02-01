import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSlackOAuthUrl } from '@/lib/slack'
import { randomBytes } from 'crypto'

// GET /api/integrations/slack/oauth - Initiate Slack OAuth flow
export async function GET() {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Generate state token for CSRF protection
    const state = randomBytes(16).toString('hex')

    // Store state in cookie for verification
    const response = NextResponse.redirect(getSlackOAuthUrl(state))
    response.cookies.set('slack_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
    })

    return response
  } catch (error) {
    console.error('Slack OAuth initiation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
