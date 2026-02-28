# Plan: Grain OAuth — Persistent Token Management

## Problem

The Grain MCP integration uses static env var tokens (`GRAIN_MCP_TOKEN`, `GRAIN_MCP_REFRESH_TOKEN`). These expire and require manual re-auth via browser OAuth flow. The production transcript ingestion cron silently fails when tokens expire, breaking briefing quality and EA context.

## Goal

One-click Grain OAuth from Settings > Integrations, with automatic token refresh — same pattern as Google and QuickBooks. Auth once, tokens self-maintain.

## Architecture Decision

**Follow the Google OAuth pattern** (simplest, cleanest in the codebase):
- PKCE-based OAuth 2.0 (Grain uses `S256` code challenge, public client)
- Store `refresh_token` in `partner_preferences` (organization-scoped, one row per partner)
- The cron reads tokens from DB instead of env vars
- On each cron run, refresh the access token via Grain's token endpoint, persist any rotated refresh token back to DB

**Key difference from current approach**: Tokens move from env vars to database. The `grain-mcp-client.ts` accepts tokens as parameters instead of reading from `process.env`.

## Grain OAuth Details (from `.well-known/oauth-authorization-server`)

| Field | Value |
|-------|-------|
| Authorization URL | `https://grain.com/_/public-api/oauth2/authorize` |
| Token URL | `https://api.grain.com/_/public-api/oauth2/token` |
| Registration URL | `https://api.grain.com/_/mcp/oauth_registration` |
| Grant type | `authorization_code` |
| PKCE | S256 |
| Client auth | Public (no secret required) |

Grain supports [MCP Dynamic Client Registration](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization) — clients register themselves at `/oauth_registration` to get a `client_id`. We already have `GRAIN_MCP_CLIENT_ID=ENRCYQDGXA`, so we skip registration and use the existing client.

## Implementation Plan

### Phase 1: Database Migration

**File**: `ember/supabase/migrations/017_add_grain_oauth_columns.sql`

Add columns to `partner_preferences`:
```sql
ALTER TABLE public.partner_preferences
ADD COLUMN IF NOT EXISTS grain_refresh_token TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS grain_client_id TEXT DEFAULT NULL;
```

The `grain_client_id` is stored per-org because Grain's dynamic registration creates per-client IDs. We seed it from the existing env var during the OAuth flow.

### Phase 2: OAuth Routes

**2a. Initiation route**: `ember/src/app/api/agents/auth/grain/route.ts`

Pattern: Copy Google OAuth route structure. Key steps:
1. Verify user is authenticated
2. Generate PKCE `code_verifier` (random 43-128 chars) and `code_challenge` (SHA-256 base64url)
3. Store `code_verifier` + user state in a short-lived HTTP-only cookie (same as Slack's CSRF pattern)
4. Build authorization URL with params:
   - `client_id`: from env var `GRAIN_MCP_CLIENT_ID`
   - `redirect_uri`: `${NEXT_PUBLIC_APP_URL}/api/agents/auth/grain/callback`
   - `response_type`: `code`
   - `code_challenge`: computed
   - `code_challenge_method`: `S256`
   - `state`: base64url(`{ userId, nonce }`)
5. Redirect user to Grain's authorization URL

**2b. Callback route**: `ember/src/app/api/agents/auth/grain/callback/route.ts`

1. Verify user is authenticated + state matches
2. Read `code_verifier` from cookie
3. POST to Grain's token endpoint:
   ```
   POST https://api.grain.com/_/public-api/oauth2/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code
   &code=<auth_code>
   &redirect_uri=<callback_url>
   &client_id=<GRAIN_MCP_CLIENT_ID>
   &code_verifier=<from_cookie>
   ```
4. Extract `access_token`, `refresh_token`, `expires_in`
5. Upsert into `partner_preferences`:
   - `grain_refresh_token`: the refresh token
   - `grain_client_id`: the client ID used
6. Clear the PKCE cookie
7. Redirect to `/dashboard/settings/integrations?success=grain_connected`

### Phase 3: Update grain-mcp-client.ts

Refactor `getAccessToken()` to accept tokens as parameters instead of reading env vars:

```typescript
interface GrainTokenConfig {
  refreshToken: string
  clientId: string
}

async function getAccessToken(config: GrainTokenConfig): Promise<{
  accessToken: string
  newRefreshToken?: string  // if rotated
}>
```

Key changes:
- Accept `refreshToken` and `clientId` as params (from DB, not env)
- Return any rotated `refresh_token` so the caller can persist it
- Keep env var fallback for backward compatibility during migration
- All public functions (`listMeetings`, `fetchTranscript`, etc.) gain an optional `tokenConfig` parameter

### Phase 4: Update Transcript Ingest Cron

**File**: `ember/src/app/api/agents/cron/ingest/transcripts/route.ts`

Changes to `ingestFromGrainMcp()`:
1. Read `grain_refresh_token` and `grain_client_id` from `partner_preferences` (already loaded by `loadPartners()`)
2. Pass token config to `grain-mcp-client` functions
3. After each successful refresh, persist any rotated `refresh_token` back to `partner_preferences`
4. Fall back to env vars if DB tokens not set (transition period)

Update `loadPartners()` in `ingest-helpers.ts` to also select `grain_refresh_token, grain_client_id`.

### Phase 5: Integrations UI

**File**: `ember/src/app/dashboard/settings/integrations/page.tsx`

Add Grain to `CONNECTOR_META`:
```typescript
grain: {
  label: 'Grain',
  description: 'Meeting transcripts, notes, and coaching feedback',
  color: '#6366F1',
  authUrl: '/api/agents/auth/grain',
  disconnectable: true,
}
```

**File**: `ember/src/app/api/agents/status/route.ts`

Add Grain status check — read `grain_refresh_token` from `partner_preferences` and `grain` source from `ingested_data` for last sync.

**File**: `ember/src/app/api/agents/disconnect/route.ts`

Add `'grain'` to the allowed connectors list, null out `grain_refresh_token` and `grain_client_id`.

### Phase 6: Cleanup

- Remove `GRAIN_MCP_TOKEN` and `GRAIN_MCP_REFRESH_TOKEN` from Vercel env vars (after confirming DB flow works)
- Keep `GRAIN_MCP_CLIENT_ID` as fallback for the OAuth initiation route
- Update `GRAIN_MCP_URL` to stay as env var (server URL, not a secret)

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/017_add_grain_oauth_columns.sql` | Create | Add `grain_refresh_token`, `grain_client_id` columns |
| `app/api/agents/auth/grain/route.ts` | Create | OAuth initiation with PKCE |
| `app/api/agents/auth/grain/callback/route.ts` | Create | Code exchange + token storage |
| `lib/connectors/grain-mcp-client.ts` | Modify | Accept token params, return rotated tokens |
| `lib/agents/ingest-helpers.ts` | Modify | Select grain token columns in `loadPartners()` |
| `app/api/agents/cron/ingest/transcripts/route.ts` | Modify | Read tokens from DB, persist rotations |
| `app/dashboard/settings/integrations/page.tsx` | Modify | Add Grain card |
| `app/api/agents/status/route.ts` | Modify | Add Grain status |
| `app/api/agents/disconnect/route.ts` | Modify | Support Grain disconnect |

## Risks & Mitigations

1. **Grain may not issue refresh tokens** — Their OAuth metadata doesn't explicitly confirm refresh token support. Mitigation: test during implementation. If no refresh token, we store the access token with its expiry and prompt re-auth when expired (same as current situation but with UI feedback).

2. **Token rotation in serverless** — If two concurrent cron invocations both refresh, one could overwrite the other's new token. Mitigation: the transcript cron already deduplicates by org (`processedOrgs` Set), so only one refresh per org per invocation.

3. **PKCE cookie loss** — If the user's browser blocks cookies between the redirect and callback. Mitigation: use `SameSite=Lax` (allowed for top-level navigations), same as Slack's existing pattern.
