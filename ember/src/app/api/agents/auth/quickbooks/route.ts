import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OAuthClient from 'intuit-oauth'
import { randomBytes } from 'crypto'

function createQBOAuthClient() {
  return new OAuthClient({
    clientId: process.env.QUICKBOOKS_CLIENT_ID!,
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
    environment: (process.env.QUICKBOOKS_ENVIRONMENT || 'production') as 'sandbox' | 'production',
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'https://caldera-eos.vercel.app'}/api/agents/auth/quickbooks/callback`,
  })
}

export { createQBOAuthClient }

// GET /api/agents/auth/quickbooks - Initiate QuickBooks OAuth
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const oauthClient = createQBOAuthClient()

    const state = JSON.stringify({
      userId: user.id,
      nonce: randomBytes(16).toString('hex'),
    })
    const encodedState = Buffer.from(state).toString('base64url')

    const authUri = oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting],
      state: encodedState,
    })

    return NextResponse.redirect(authUri)
  } catch (error) {
    console.error('QuickBooks OAuth initiation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
