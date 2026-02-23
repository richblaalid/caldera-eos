import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://caldera-eos.vercel.app'
const REDIRECT_URI = `${APP_URL}/api/agents/auth/hubspot/callback`

const SCOPES = [
  'crm.objects.deals.read',
  'crm.objects.contacts.read',
  'crm.objects.companies.read',
  'crm.objects.owners.read',
]

// GET /api/agents/auth/hubspot - Initiate HubSpot OAuth
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const state = JSON.stringify({
      userId: user.id,
      nonce: randomBytes(16).toString('hex'),
    })
    const encodedState = Buffer.from(state).toString('base64url')

    const authUrl = `https://app.hubspot.com/oauth/authorize` +
      `?client_id=${HUBSPOT_CLIENT_ID}` +
      `&scope=${encodeURIComponent(SCOPES.join(' '))}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&state=${encodedState}`

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('HubSpot OAuth initiation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
