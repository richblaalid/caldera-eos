import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes, createHash } from 'crypto'
import { cookies } from 'next/headers'

const GRAIN_AUTH_URL = 'https://grain.com/_/public-api/oauth2/authorize'

/**
 * Generate PKCE code verifier and challenge (S256).
 */
function generatePKCE() {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

// GET /api/agents/auth/grain - Initiate Grain OAuth with PKCE
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.GRAIN_MCP_CLIENT_ID
    if (!clientId) {
      return NextResponse.json({ error: 'Grain not configured' }, { status: 500 })
    }

    // Generate PKCE pair
    const { verifier, challenge } = generatePKCE()

    // State for CSRF protection
    const state = JSON.stringify({
      userId: user.id,
      nonce: randomBytes(16).toString('hex'),
    })
    const encodedState = Buffer.from(state).toString('base64url')

    // Store verifier in cookie (needed for callback)
    const cookieStore = await cookies()
    cookieStore.set('grain_pkce_verifier', verifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/api/agents/auth/grain',
    })

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'https://caldera-eos.vercel.app'}/api/agents/auth/grain/callback`

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: encodedState,
    })

    return NextResponse.redirect(`${GRAIN_AUTH_URL}?${params.toString()}`)
  } catch (error) {
    console.error('Grain OAuth initiation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
