import { google } from 'googleapis'

/**
 * Creates a Google OAuth2 client configured with app credentials.
 * Used as the base for all Google API interactions.
 */
export function createGoogleOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/agents/auth/google/callback`
  )
}

/**
 * Creates a Google OAuth2 client with a partner's refresh token.
 * Used for making authenticated API calls on behalf of a partner.
 */
export function createAuthenticatedGoogleClient(refreshToken: string) {
  const client = createGoogleOAuth2Client()
  client.setCredentials({ refresh_token: refreshToken })
  return client
}

/**
 * Scopes required for Gmail and Calendar access.
 */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
]

/**
 * Generate the Google OAuth consent URL for a partner to authorize
 * Gmail and Calendar access.
 */
export function getGoogleAuthUrl(state: string) {
  const client = createGoogleOAuth2Client()
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
    prompt: 'consent', // Force consent to get refresh token
    state,
  })
}
