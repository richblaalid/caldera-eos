# Ember Code Health Audit — 2026-03-01

## Executive Summary

Four parallel audits covering security, dead code, duplication, and type safety across the Ember codebase. The codebase has solid foundations — consistent EOS route patterns, proper use of Supabase parameterized queries (no SQL injection), no hardcoded secrets, and good XSS protection in Slack output. However, there are critical security gaps in auth patterns, significant dead code accumulation, systemic duplication in the agent layer, and type/schema mismatches causing silent runtime failures.

---

## Critical Issues (Fix Immediately)

### C1. CRON_SECRET bypass when env var is unset
**Files:** `ingest-helpers.ts` + 10 cron/test routes
If `CRON_SECRET` is not set, the auth check becomes `authHeader !== 'Bearer undefined'` — any request with `Authorization: Bearer undefined` passes in production. The `NODE_ENV === 'development'` bypass is also completely open.
**Fix:** Fail closed when `CRON_SECRET` is undefined. Remove or scope the dev bypass.

### C2. Slack retry header bypasses signature verification
**File:** `app/api/agents/events/slack/route.ts:62`
The `X-Slack-Retry-Num` check returns `{ ok: true }` *before* signature verification. Any request with this header skips auth entirely.
**Fix:** Move signature verification before the retry check.

### C3. `priority: 'high'` inserted into INT column — silent failures
**Files:** All 6 agent `create*Issue` functions
Agents insert `priority: 'high'` (string) into `issues.priority` which is `INT DEFAULT 0`. PostgreSQL rejects the coercion, and since insert errors are swallowed, auto-created issues silently fail.
**Fix:** Use `priority: 1` (or change schema to enum/text).

### C4. `getScorecardMetrics` queries non-existent columns
**File:** `financial-strategist.ts:284`
Queries `.select('title, goal, owner_id')` but the actual columns are `name` and `target`. Always returns null data, meaning financial analysis scorecard context is always empty.
**Fix:** Change to `.select('name, target, owner_id')`.

---

## High Priority Issues

### H1. Missing fetch timeouts on all external API calls
**Files:** `quickbooks-connector.ts`, `hubspot-connector.ts`, `grain-mcp-client.ts`, `slack.ts`
Only `brave-search-client.ts` has timeouts. A hanging external call can consume the full Vercel function budget (5 min).
**Fix:** Add `AbortController` with 30s timeouts to all external fetches.

### H2. HubSpot engagement pagination can loop indefinitely
**File:** `hubspot-connector.ts:133`
If the API returns `hasMore: true` persistently or `offset` resets to 0, the loop runs until Vercel kills it.
**Fix:** Add `MAX_PAGES = 10` guard and stuck-pagination detection.

### H3. No input size limits on transcript seed endpoint
**File:** `seed/transcripts/route.ts`
Accepts unlimited array of unlimited-length transcripts, each triggering multiple LLM calls.
**Fix:** Cap at 50 transcripts, 200K chars per transcript.

### H4. `org_id` in seed endpoint not validated
**File:** `test/seed/route.ts:29`
Accepts any string as org_id and seeds data into it. With dev bypass, any caller can target any org.
**Fix:** UUID format validation.

### H5. Inconsistent auth patterns — 10 routes use copy-pasted inline auth
**Files:** All cron routes except the 4 ingest routes
The `verifyCronAuth` helper exists but only ingest routes use it. 10 other routes have the inline copy-paste.
**Fix:** Migrate all cron/test routes to `verifyCronAuth`.

### H6. `AgentOutput.content` typed as `Record<string, unknown>`
**File:** `types/agents.ts:52`
Every agent stores a fully-typed Zod-validated analysis object but casts it to `Record<string, unknown>`. Every consumer must re-cast without any compile-time safety. Schema changes propagate silently.
**Fix:** Discriminated union on `output_type` + `agent_id`, or at minimum per-agent content types.

---

## Medium Priority Issues

### M1. `agent_runs` status ternary is a no-op
**Files:** `morning-briefing/route.ts:194`, `overnight-analysis/route.ts:201`
```typescript
status: results.errors.length === 0 ? 'completed' : 'completed'  // always 'completed'
```
**Fix:** Change to `'completed' : 'failed'`.

### M2. Module-level `supabaseAdmin` in 20+ files
All agent files create their own `createClient()` at module level. This is duplicated 20+ times and can break during builds when env vars aren't set.
**Fix:** Single lazy singleton in `lib/supabase/admin.ts`.

### M3. `PartnerPreferences` type missing 4 DB columns
**File:** `types/agents.ts:300`
Missing `grain_refresh_token`, `grain_client_id`, `hubspot_refresh_token`, `hubspot_portal_id` from migrations 012 and 017.
**Fix:** Add missing fields.

### M4. `Database['briefings']['Row']` maps to v1, not v2
**File:** `types/database.ts:889`
Typed Supabase queries on `briefings` table don't know about v2 columns.
**Fix:** Update Database type to include v2 columns.

### M5. Slack OAuth state cookie parsed via fragile header splitting
**File:** `integrations/slack/callback/route.ts:36`
Manual cookie parsing that breaks on `=` in values. Next.js provides `cookies()` API.
**Fix:** Use `cookies()` from `next/headers`.

### M6. Scorecard values from Slack not validated for range
**File:** `events/slack/route.ts:196`
Users can send `Billable Utilization: -9999999999` or `Infinity` — written directly to DB.
**Fix:** Add `isFinite(value) && value >= 0 && value <= 1_000_000` guard.

### M7. LLM JSON responses parsed without Zod validation
**Files:** `gmail-connector.ts:224`, `command-parser.ts:139`
`JSON.parse` output accessed by field name with no structural validation. Wrong field names produce silent undefined.
**Fix:** Add Zod schema at LLM response boundary.

---

## Dead Code — Safe to Remove

### Major Dead Code Clusters

| Code | Location | ~Lines | Notes |
|------|----------|--------|-------|
| `generateBriefingV1` + v1 helpers | `ea-briefing.ts:216` | ~600 | Entire v1 stack: schema, prompts, formatter |
| `invokeAgent` + `prompt-manager.ts` | `agent-runtime.ts:26` | ~200 | Designed orchestration layer never wired up |
| `EMBER_TOOLS` (Anthropic SDK format) | `ember-tools.ts:22` | ~100 | Superseded by Vercel AI SDK `tool()` format |
| `proxy.ts` | `src/proxy.ts` | ~30 | Orphaned middleware stub |

### Unused Exports (HIGH confidence)

| Export | File |
|--------|------|
| `findSlackUserByEmail` | `slack.ts:244` |
| `syncSlackUserIds` | `slack.ts:278` |
| `searchTranscripts`, `searchEOSKnowledge`, `keywordSearch`, `semanticSearch` | `hybrid-search.ts:377-412` |
| `CALDERA_PARTNERS`, `CALDERA_BUSINESS_CONTEXT` | `ember.ts:9,28` |
| `generateEmbeddingWithMetadata`, `generateEmbeddingsWithMetadata` | `embeddings.ts:61,116` |
| `EmbeddingResult`, `BatchEmbeddingResult`, `__testing` | `embeddings.ts:36,41,215` |

### Unused Types (HIGH confidence)

| Type | File |
|------|------|
| `BriefingV2` | `agents.ts:259` |
| `ClassifiedEmail` | `agents.ts:385` |
| `ClassifiedCalendarEvent` | `agents.ts:403` |
| `AgentInvocation` | `agents.ts:338` |
| `AgentResult`, `SlackNotification`, `EOSAction` | `agents.ts:346-364` |

---

## Duplication — Standardization Opportunities

### D1. Agent `create*Issue` function — identical in 7 files
Every agent has its own private `createXxxIssue(orgId, title, detail)` with the same dedup-check + insert pattern. Only the agent name prefix differs.
**Fix:** Shared `createAgentIssue(supabase, orgId, agentName, title, detail)` in `agent-runtime.ts`.

### D2. `getUserOrganizationId` — 3 separate implementations
- Full version in `eos.ts:34` (with auto-assign)
- Copy-pasted in `api/eos/vto/route.ts:6`
- Simplified version in `eos/checkup.ts:455`
**Fix:** Export from `eos.ts`, import everywhere.

### D3. `isSimilar` dedup function — identical in 3 files
`metric-suggestions.ts`, `todo-suggestions.ts`, `issue-suggestions.ts` all have the same word-overlap algorithm.
**Fix:** Shared `lib/suggestion-utils.ts`.

### D4. Date calculations — `thirtyDaysAgo` in 7 files
```typescript
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
```
**Fix:** `lib/dates.ts` with `daysAgo(n)`, `todayUTC()`, `toLocalDate()`, `getCurrentWeekStart()`.

### D5. Barrel exports missing for `lib/agents/`, `lib/connectors/`
Components have barrel exports; the agent/connector layer does not, leading to long direct-path imports.

---

## Large Files (>500 lines)

| File | Lines | Recommendation |
|------|-------|---------------|
| `ea-briefing.ts` | 1415 | Split: data fetching, prompt building, orchestrator |
| `ember-tools.ts` | 884 | Separate tool definitions from business logic helpers |
| `eos.ts` | 713 | Split per domain: `eos/rocks.ts`, `eos/issues.ts`, etc. |
| `morning-briefing/route.ts` | 516 | Extract `deliverNudges`, `sendPreMeetingPreps` to dedicated files |
| `operations-architect.ts` | 520 | Near limit — monitor |

---

## What's Working Well

- **No SQL injection** — all queries use Supabase parameterized client
- **No hardcoded secrets** — all credentials in env vars
- **No XSS** — Slack output properly escaped via `escapeSlackMrkdwn`
- **EOS route auth** — all 30+ user-facing routes consistently check `supabase.auth.getUser()`
- **Agent Zod schemas** — all 6 strategic agents validate Claude output with Zod
- **Consistent EOS route structure** — `try { auth → params → execute → respond } catch { 500 }`
- **Brave Search timeout** — correctly implements `AbortController` (model for other fetches)

---

## Recommended Priority Order

1. **C3 + C4** — Silent runtime bugs (issues not created, scorecard data empty)
2. **C1 + C2** — Security auth gaps
3. **M1** — Status ternary no-op (audit log integrity)
4. **H1 + H2** — Timeout/runaway loop protection
5. **Dead code removal** — ~1000 lines of `generateBriefingV1` + `invokeAgent` + `prompt-manager`
6. **D1 + D2 + M2** — Dedup `create*Issue`, `getUserOrganizationId`, `supabaseAdmin`
7. **H6 + M3 + M4** — Type safety improvements
8. **Everything else** — incremental cleanup
