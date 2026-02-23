import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleAuthUrl } from '@/lib/connectors/google-auth'
import { randomBytes } from 'crypto'

// GET /api/agents/auth/google - Initiate Google OAuth for Gmail + Calendar access
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // State contains user ID for callback verification
    const state = JSON.stringify({
      userId: user.id,
      nonce: randomBytes(16).toString('hex'),
    })

    const encodedState = Buffer.from(state).toString('base64url')
    const authUrl = getGoogleAuthUrl(encodedState)

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Google OAuth initiation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
