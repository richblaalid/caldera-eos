# Code Health Remediation Plan

**Source:** [Code Health Audit 2026-03-01](../code-health-audit-2026-03-01.md)
**Scope:** Fix all critical, high, and medium issues; remove dead code; reduce systemic duplication
**Approach:** 5 phases, smallest-blast-radius first, each independently shippable

---

## Phase 0: Critical Runtime Bugs (Silent Failures)

**Goal:** Fix the two bugs actively breaking production features right now.

### 0.1 Fix `priority: 'high'` → `priority: 1` in all 7 agent `create*Issue` functions
The `issues` table has `priority INT DEFAULT 0`. All 7 agents insert `priority: 'high'` (string), which PostgreSQL rejects. Since the insert error is swallowed, auto-created issues silently fail to persist.

**Files (7):**
- `ember/src/lib/agents/financial-strategist.ts:399`
- `ember/src/lib/agents/bd-strategist.ts:428`
- `ember/src/lib/agents/operations-architect.ts:516`
- `ember/src/lib/agents/marketing-strategist.ts:331`
- `ember/src/lib/agents/product-innovation.ts:337`
- `ember/src/lib/agents/pattern-detector.ts:541`
- `ember/src/lib/agents/nudge-engine.ts:411`

**Change:** `priority: 'high'` → `priority: 1` in each file.

### 0.2 Fix `getScorecardMetrics` column names in financial-strategist
Queries `.select('title, goal, owner_id')` but actual columns are `name` and `target`.

**File:** `ember/src/lib/agents/financial-strategist.ts:284`

**Change:** `.select('title, goal, owner_id')` → `.select('name, target, owner_id')`

### 0.3 Fix `agent_runs` status ternary no-op
Both branches return `'completed'` — agent failures are never logged.

**Files (2):**
- `ember/src/app/api/agents/cron/morning-briefing/route.ts` — status ternary
- `ember/src/app/api/agents/cron/overnight-analysis/route.ts` — status ternary

**Change:** `'completed' : 'completed'` → `'completed' : 'failed'`

**Checkpoint:** `npm run typecheck && npm run test` pass. Deploy and trigger overnight-analysis + morning-briefing to verify issues are now being created and agent_runs correctly log failures.

---

## Phase 1: Security Hardening

**Goal:** Close auth bypass vectors and add input validation.

### 1.1 Harden `verifyCronAuth` — fail closed when CRON_SECRET is unset
Update the shared helper in `ingest-helpers.ts` to reject all requests when `CRON_SECRET` is undefined, removing the `NODE_ENV === 'development'` bypass.

**File:** `ember/src/lib/agents/ingest-helpers.ts:11-18`

**New logic:**
```typescript
export function verifyCronAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
```

### 1.2 Migrate all cron/test routes to use `verifyCronAuth`
Replace the copy-pasted inline auth blocks in 10 routes with `verifyCronAuth(request)` import.

**Files (10):**
- `ember/src/app/api/agents/cron/overnight-analysis/route.ts`
- `ember/src/app/api/agents/cron/morning-briefing/route.ts`
- `ember/src/app/api/agents/cron/scorecard-automation/route.ts`
- `ember/src/app/api/cron/checkup-reminders/route.ts`
- `ember/src/app/api/cron/generate-prep/route.ts`
- `ember/src/app/api/agents/test/qbo/route.ts`
- `ember/src/app/api/agents/test/pipeline/route.ts`
- `ember/src/app/api/agents/test/seed/route.ts`
- `ember/src/app/api/agents/seed/transcripts/route.ts`
- `ember/src/app/api/agents/seed/transcripts/process/route.ts`

### 1.3 Fix Slack signature verification order
Move signature verification before the retry check in the Slack event handler.

**File:** `ember/src/app/api/agents/events/slack/route.ts:60-78`

**Change:** Reorder so signature verification happens before the `x-slack-retry-num` early return.

### 1.4 Add input validation to seed/test endpoints
- UUID validation on `org_id` parameter in `test/seed/route.ts`
- Array size limit (50) and per-transcript text length limit (200K chars) in `seed/transcripts/route.ts`
- Scorecard value range validation (`isFinite && >= 0 && <= 1_000_000`) in Slack event handler

**Files (3):**
- `ember/src/app/api/agents/test/seed/route.ts`
- `ember/src/app/api/agents/seed/transcripts/route.ts`
- `ember/src/app/api/agents/events/slack/route.ts`

### 1.5 Fix Slack OAuth cookie parsing
Replace manual header-splitting with `cookies()` from `next/headers`.

**File:** `ember/src/app/api/integrations/slack/callback/route.ts:36-47`

**Checkpoint:** `npm run typecheck && npm run test && npm run build` pass. All routes reject unauthenticated requests.

---

## Phase 2: Resilience — Timeouts and Guards

**Goal:** Prevent hanging external calls and runaway loops from consuming Vercel function budgets.

### 2.1 Create shared `fetchWithTimeout` utility
Add a thin wrapper around `fetch` with `AbortController` timeout. Model after `brave-search-client.ts:64`.

**New file:** `ember/src/lib/fetch-utils.ts`

```typescript
export async function fetchWithTimeout(
  url: string | URL,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 30_000, ...fetchOptions } = options
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}
```

### 2.2 Add timeouts to QuickBooks connector
Replace bare `fetch` calls with `fetchWithTimeout` in `quickbooks-connector.ts`.

**File:** `ember/src/lib/connectors/quickbooks-connector.ts`

### 2.3 Add timeouts to HubSpot connector + pagination guard
Replace bare `fetch` calls with `fetchWithTimeout` and add `MAX_PAGES = 10` + stuck-pagination detection to engagement loop.

**File:** `ember/src/lib/connectors/hubspot-connector.ts`

### 2.4 Add timeouts to Grain MCP client
Replace bare `fetch` in token refresh with `fetchWithTimeout`.

**File:** `ember/src/lib/connectors/grain-mcp-client.ts`

### 2.5 Add timeouts to Slack API calls
Replace bare `fetch` calls in `slack.ts` with `fetchWithTimeout`.

**File:** `ember/src/lib/slack.ts`

**Checkpoint:** `npm run typecheck && npm run test && npm run build` pass. External calls now fail fast after 30s.

---

## Phase 3: Dead Code Removal

**Goal:** Remove ~1000 lines of confirmed dead code to reduce maintenance surface.

### 3.1 Remove v1 briefing stack from ea-briefing.ts
Remove `generateBriefingV1`, `briefingSchemaV1`, `buildEASystemPrompt`, `buildBriefingPrompt`, and the v1 conditional branch in `deliverBriefing`.

**Files:**
- `ember/src/lib/agents/ea-briefing.ts` — remove ~600 lines
- `ember/src/lib/agents/slack-briefing.ts` — remove `formatBriefingBlocks` (v1 formatter) and v1 branch in `deliverBriefing`

### 3.2 Remove unused `invokeAgent` orchestration layer
Remove `invokeAgent` from `agent-runtime.ts` and the entire `prompt-manager.ts` file. Remove dead re-exports.

**Files:**
- `ember/src/lib/agents/agent-runtime.ts` — remove `invokeAgent`, `loadAgentDefinition` (if only used by invokeAgent), dead re-exports
- `ember/src/lib/agents/prompt-manager.ts` — delete file

### 3.3 Remove unused exports from slack.ts, hybrid-search.ts, ember.ts, embeddings.ts, ember-tools.ts
- `slack.ts`: remove `findSlackUserByEmail`, `syncSlackUserIds`
- `hybrid-search.ts`: remove `searchTranscripts`, `searchEOSKnowledge`, `keywordSearch`, `semanticSearch`
- `ember.ts`: remove `CALDERA_PARTNERS`, `CALDERA_BUSINESS_CONTEXT`, un-export `EMBER_CHAT_SYSTEM_PROMPT` and `getJourneyStageFocus`
- `embeddings.ts`: remove `generateEmbeddingWithMetadata`, `generateEmbeddingsWithMetadata`, `EmbeddingResult`, `BatchEmbeddingResult`, `__testing`
- `ember-tools.ts`: remove `EMBER_TOOLS` (Anthropic SDK format array)

### 3.4 Remove orphaned proxy.ts and unused types
- Delete `ember/src/proxy.ts`
- Remove from `types/agents.ts`: `BriefingV2`, `ClassifiedEmail`, `ClassifiedCalendarEvent`, `AgentInvocation`, `AgentResult`, `SlackNotification`, `EOSAction`

**Checkpoint:** `npm run typecheck && npm run test && npm run build` pass. No functional changes — pure removal.

---

## Phase 4: Deduplication — Shared Utilities

**Goal:** Consolidate repeated patterns into shared modules.

### 4.1 Create shared `supabaseAdmin` singleton
Create `ember/src/lib/supabase/admin.ts` with a lazy singleton. Update all 20+ agent/connector/cron files to import from it.

**New file:** `ember/src/lib/supabase/admin.ts`
**Modified files:** All agent files, connector files, cron routes that create inline `supabaseAdmin`.

### 4.2 Create shared `createAgentIssue` in agent-runtime.ts
Extract the dedup-check + insert pattern from all 7 `create*Issue` functions into a shared helper. Remove the 7 private duplicates.

**File:** `ember/src/lib/agents/agent-runtime.ts` — add `createAgentIssue(orgId, agentName, title, detail)`
**Modified files (7):** All agent files with private `create*Issue` functions.

### 4.3 Create `lib/dates.ts` utility
Consolidate repeated date calculations: `daysAgo(n)`, `todayUTC()`, `toLocalDate(date, tz)`, `getCurrentWeekStart()`.

**New file:** `ember/src/lib/dates.ts`
**Modified files:** 7 agent files with `thirtyDaysAgo`, `scorecard-automation.ts`, `ea-briefing.ts`.

### 4.4 Create shared `isSimilarTitle` utility
Move the duplicated word-overlap similarity function to a shared module.

**New file:** `ember/src/lib/suggestion-utils.ts`
**Modified files (3):** `metric-suggestions.ts`, `todo-suggestions.ts`, `issue-suggestions.ts`.

### 4.5 Deduplicate `getUserOrganizationId`
Export from `eos.ts`, remove copy in `vto/route.ts`, update `checkup.ts` to import.

**Modified files (3):** `lib/eos.ts`, `api/eos/vto/route.ts`, `lib/eos/checkup.ts`.

**Checkpoint:** `npm run typecheck && npm run test && npm run build` pass. Code is functionally identical but consolidated.

---

## Phase 5: Type Safety Improvements

**Goal:** Close type/schema gaps to prevent future silent runtime bugs.

### 5.1 Add missing columns to `PartnerPreferences` type
Add `grain_refresh_token`, `grain_client_id`, `hubspot_refresh_token`, `hubspot_portal_id`.

**File:** `ember/src/types/agents.ts:300-332`

### 5.2 Update `Database['briefings']` to include v2 columns
Add `briefing_version`, `is_monday`, `tactical_items`, `strategic_items`, `fyi_item`, `agent_insights`, `agent_work_queue_overflow` to the database type.

**File:** `ember/src/types/database.ts:889`

### 5.3 Add Zod validation to LLM JSON response boundaries
Add Zod schemas for Gmail classifier response and command parser response.

**Files (2):** `ember/src/lib/connectors/gmail-connector.ts:224`, `ember/src/lib/agents/command-parser.ts:139`

### 5.4 Type the Slack event payload
Replace `payload: any` with a structural `SlackEventPayload` interface.

**File:** `ember/src/app/api/agents/events/slack/route.ts:44-45`

**Checkpoint:** `npm run typecheck && npm run test && npm run build` pass. Type coverage improved, no functional changes.

---

## Deferred (Out of Scope)

The following items from the audit are deferred as lower priority or higher risk:

| Item | Reason |
|------|--------|
| H6: `AgentOutput.content` discriminated union | Large refactor touching all agents + consumers; best done alongside a feature change |
| D5: Barrel exports for agents/connectors | Cosmetic; no functional benefit without restructuring imports project-wide |
| Large file splits (ea-briefing, eos.ts, ember-tools) | High risk of merge conflicts; do alongside next feature touching those files |
| M2 completion (supabaseAdmin in test routes) | Covered by 4.1 but test routes have lower priority since they're dev-only |

---

## Risk Assessment

| Phase | Risk | Mitigation |
|-------|------|-----------|
| 0 | Low — simple value changes | Typecheck + test + verify agent output in DB |
| 1 | Medium — auth changes could lock out cron jobs | Test each route with CRON_SECRET before deploying |
| 2 | Low — additive (timeouts don't change happy path) | Generous 30s timeout; only affects hanging calls |
| 3 | Medium — removing code could break unused paths | Typecheck catches imports; test + build confirms |
| 4 | Medium — refactoring shared code | Each dedup task is independent; typecheck after each |
| 5 | Low — additive type annotations | No runtime behavior changes |
