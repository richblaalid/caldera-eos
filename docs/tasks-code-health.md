# Code Health Remediation: Task List

**Plan:** `docs/plans/code-health-remediation.md`
**Audit:** `docs/code-health-audit-2026-03-01.md`

---

## Phase 0: Critical Runtime Bugs

### 0.1 Fix `priority: 'high'` → `priority: 1`

- [x] **0.1.1** Fix priority in `financial-strategist.ts`
  - Change `priority: 'high'` → `priority: 1` in `createFinancialIssue`
  - **File:** `ember/src/lib/agents/financial-strategist.ts:399`

- [x] **0.1.2** Fix priority in `bd-strategist.ts`
  - Change `priority: 'high'` → `priority: 1` in `createPipelineIssue`
  - **File:** `ember/src/lib/agents/bd-strategist.ts:428`

- [x] **0.1.3** Fix priority in `operations-architect.ts`
  - Change `priority: 'high'` → `priority: 1` in `createOperationsIssue`
  - **File:** `ember/src/lib/agents/operations-architect.ts:516`

- [x] **0.1.4** Fix priority in `marketing-strategist.ts`
  - Change `priority: 'high'` → `priority: 1` in `createMarketingIssue`
  - **File:** `ember/src/lib/agents/marketing-strategist.ts:331`

- [x] **0.1.5** Fix priority in `product-innovation.ts`
  - Change `priority: 'high'` → `priority: 1` in `createInnovationIssue`
  - **File:** `ember/src/lib/agents/product-innovation.ts:337`

- [x] **0.1.6** Fix priority in `pattern-detector.ts`
  - Change `priority: 'high'` → `priority: 1` in `createPatternIssue`
  - **File:** `ember/src/lib/agents/pattern-detector.ts:541`

- [x] **0.1.7** Fix priority in `nudge-engine.ts`
  - Change `priority: 'high'` → `priority: 1` in `createEscalationIssue`
  - **File:** `ember/src/lib/agents/nudge-engine.ts:411`

### 0.2 Fix scorecard column names

- [x] **0.2.1** Fix `getScorecardMetrics` query in financial-strategist
  - Change `.select('title, goal, owner_id')` → `.select('name, target, owner_id')`
  - Update references to `title`/`goal` downstream to `name`/`target`
  - **File:** `ember/src/lib/agents/financial-strategist.ts:283-286`

### 0.3 Fix agent_runs status ternary

- [x] **0.3.1** Fix status ternary in morning-briefing route
  - Change `'completed' : 'completed'` → `'completed' : 'failed'`
  - **File:** `ember/src/app/api/agents/cron/morning-briefing/route.ts`

- [x] **0.3.2** Fix status ternary in overnight-analysis route
  - Change `'completed' : 'completed'` → `'completed' : 'failed'`
  - **File:** `ember/src/app/api/agents/cron/overnight-analysis/route.ts`

**Phase 0 Checkpoint:** `npm run typecheck && npm run test` pass

---

## Phase 1: Security Hardening

### 1.1 Harden verifyCronAuth

- [x] **1.1.1** Update `verifyCronAuth` to fail closed when CRON_SECRET unset
  - Add undefined check, remove dev bypass, return 500 when misconfigured
  - **File:** `ember/src/lib/agents/ingest-helpers.ts:11-18`

### 1.2 Migrate routes to verifyCronAuth

- [x] **1.2.1** Migrate overnight-analysis to verifyCronAuth
  - Replace inline auth block with `verifyCronAuth(request)` import
  - **File:** `ember/src/app/api/agents/cron/overnight-analysis/route.ts`

- [x] **1.2.2** Migrate morning-briefing to verifyCronAuth
  - **File:** `ember/src/app/api/agents/cron/morning-briefing/route.ts`

- [x] **1.2.3** Migrate scorecard-automation to verifyCronAuth
  - **File:** `ember/src/app/api/agents/cron/scorecard-automation/route.ts`

- [x] **1.2.4** Migrate checkup-reminders to verifyCronAuth
  - **File:** `ember/src/app/api/cron/checkup-reminders/route.ts`

- [x] **1.2.5** Migrate generate-prep to verifyCronAuth
  - **File:** `ember/src/app/api/cron/generate-prep/route.ts`

- [x] **1.2.6** Migrate test/qbo to verifyCronAuth
  - **File:** `ember/src/app/api/agents/test/qbo/route.ts`

- [x] **1.2.7** Migrate test/pipeline to verifyCronAuth
  - **File:** `ember/src/app/api/agents/test/pipeline/route.ts`

- [x] **1.2.8** Migrate test/seed to verifyCronAuth
  - **File:** `ember/src/app/api/agents/test/seed/route.ts`

- [x] **1.2.9** Migrate seed/transcripts to verifyCronAuth
  - **File:** `ember/src/app/api/agents/seed/transcripts/route.ts`

- [x] **1.2.10** Migrate seed/transcripts/process to verifyCronAuth
  - **File:** `ember/src/app/api/agents/seed/transcripts/process/route.ts`

### 1.3 Fix Slack signature verification order

- [x] **1.3.1** Reorder Slack event handler: verify signature before retry check
  - Move signature verification block (lines 66-78) above the retry check (lines 60-64)
  - **File:** `ember/src/app/api/agents/events/slack/route.ts`

### 1.4 Add input validation

- [x] **1.4.1** Add UUID validation for `org_id` parameter in test/seed
  - Add regex check for UUID format, reject invalid values
  - **File:** `ember/src/app/api/agents/test/seed/route.ts`

- [x] **1.4.2** Add size limits to transcript seed endpoint
  - Max 50 transcripts, max 200K chars per transcript
  - **File:** `ember/src/app/api/agents/seed/transcripts/route.ts`

- [x] **1.4.3** Add scorecard value range validation in Slack handler
  - Add `isFinite(value) && value >= 0 && value <= 1_000_000` to `tryScorecardReply`
  - **File:** `ember/src/app/api/agents/events/slack/route.ts`

### 1.5 Fix Slack OAuth cookie parsing

- [x] **1.5.1** Replace manual cookie parsing with Next.js cookies() API
  - Import `cookies` from `next/headers`, use `.get('slack_oauth_state')?.value`
  - **File:** `ember/src/app/api/integrations/slack/callback/route.ts`

**Phase 1 Checkpoint:** `npm run typecheck && npm run test && npm run build` pass

---

## Phase 2: Resilience — Timeouts and Guards

### 2.1 Create fetchWithTimeout utility

- [x] **2.1.1** Create `lib/fetch-utils.ts` with fetchWithTimeout
  - AbortController wrapper with configurable timeout (default 30s)
  - **New file:** `ember/src/lib/fetch-utils.ts`

### 2.2 Add timeouts to connectors

- [x] **2.2.1** Add timeouts to QuickBooks connector
  - Replace `fetch` calls with `fetchWithTimeout`
  - **File:** `ember/src/lib/connectors/quickbooks-connector.ts`

- [x] **2.2.2** Add timeouts to HubSpot connector + pagination guard
  - Replace `fetch` calls with `fetchWithTimeout`
  - Add MAX_PAGES=10, stuck-pagination detection to engagement loop
  - **File:** `ember/src/lib/connectors/hubspot-connector.ts`

- [x] **2.2.3** Add timeout to Grain MCP client token refresh
  - Replace `fetch` in token refresh with `fetchWithTimeout`
  - **File:** `ember/src/lib/connectors/grain-mcp-client.ts`

- [x] **2.2.4** Add timeouts to Slack API calls
  - Replace `fetch` calls in slack.ts with `fetchWithTimeout`
  - **File:** `ember/src/lib/slack.ts`

**Phase 2 Checkpoint:** `npm run typecheck && npm run test && npm run build` pass

---

## Phase 3: Dead Code Removal

### 3.1 Remove v1 briefing stack

- [x] **3.1.1** Remove `generateBriefingV1` and v1 helpers from ea-briefing.ts
  - Remove: `generateBriefingV1`, `briefingSchemaV1`, `buildEASystemPrompt`, `buildBriefingPrompt`
  - **File:** `ember/src/lib/agents/ea-briefing.ts`

- [x] **3.1.2** Remove v1 formatter and v1 branch from slack-briefing.ts
  - Remove: `formatBriefingBlocks`, v1 conditional in `deliverBriefing`
  - **File:** `ember/src/lib/agents/slack-briefing.ts`

### 3.2 Remove unused orchestration layer

- [x] **3.2.1** Remove `invokeAgent` and dead exports from agent-runtime.ts
  - Keep: `saveAgentOutput`, `loadAgentDefinition` (if used elsewhere)
  - Remove: `invokeAgent`, dead re-exports
  - **File:** `ember/src/lib/agents/agent-runtime.ts`

- [x] **3.2.2** Delete prompt-manager.ts
  - Entire file is dead code
  - **Delete:** `ember/src/lib/agents/prompt-manager.ts`

### 3.3 Remove unused exports

- [x] **3.3.1** Remove unused exports from slack.ts
  - Remove: `findSlackUserByEmail`, `syncSlackUserIds`
  - **File:** `ember/src/lib/slack.ts`

- [x] **3.3.2** Remove unused exports from hybrid-search.ts
  - Remove: `searchTranscripts`, `searchEOSKnowledge`, `keywordSearch`, `semanticSearch`
  - **File:** `ember/src/lib/hybrid-search.ts`

- [x] **3.3.3** Remove unused exports from ember.ts
  - Remove: `CALDERA_PARTNERS`, `CALDERA_BUSINESS_CONTEXT`
  - Un-export (make private): `EMBER_CHAT_SYSTEM_PROMPT`, `getJourneyStageFocus`
  - **File:** `ember/src/lib/ember.ts`

- [x] **3.3.4** Remove unused exports from embeddings.ts
  - Remove: `generateEmbeddingWithMetadata`, `generateEmbeddingsWithMetadata`, `EmbeddingResult`, `BatchEmbeddingResult`, `__testing`
  - **File:** `ember/src/lib/embeddings.ts`

- [x] **3.3.5** Remove `EMBER_TOOLS` array from ember-tools.ts
  - Remove the Anthropic SDK format tool array (superseded by Vercel AI SDK format)
  - **File:** `ember/src/lib/ember-tools.ts`

### 3.4 Remove orphaned files and unused types

- [x] **3.4.1** Delete orphaned proxy.ts
  - **Delete:** `ember/src/proxy.ts`

- [x] **3.4.2** Remove unused types from agents.ts
  - Remove: `BriefingV2`, `ClassifiedEmail`, `ClassifiedCalendarEvent`, `AgentInvocation`, `AgentResult`, `SlackNotification`, `EOSAction`
  - **File:** `ember/src/types/agents.ts`

**Phase 3 Checkpoint:** `npm run typecheck && npm run test && npm run build` pass

---

## Phase 4: Deduplication — Shared Utilities

### 4.1 Centralize supabaseAdmin

- [ ] **4.1.1** Create `lib/supabase/admin.ts` with lazy singleton
  - Export `getAdminClient()` with undefined-env guard
  - **New file:** `ember/src/lib/supabase/admin.ts`

- [ ] **4.1.2** Migrate agent files to shared admin client (batch 1)
  - Update: `financial-strategist.ts`, `bd-strategist.ts`, `operations-architect.ts`, `marketing-strategist.ts`
  - Remove inline `createClient` calls, import from `lib/supabase/admin`

- [ ] **4.1.3** Migrate agent files to shared admin client (batch 2)
  - Update: `product-innovation.ts`, `pattern-detector.ts`, `ea-briefing.ts`, `scorecard-automation.ts`

- [ ] **4.1.4** Migrate agent files to shared admin client (batch 3)
  - Update: `l10-prep.ts`, `nudge-engine.ts`, `meeting-prep.ts`, `command-executor.ts`, `slack-connector.ts`

- [ ] **4.1.5** Migrate cron routes to shared admin client
  - Update: `overnight-analysis/route.ts`, `morning-briefing/route.ts`, `scorecard-automation/route.ts`
  - Update: `checkup-reminders/route.ts`, `test/qbo/route.ts`, `test/pipeline/route.ts`, `test/seed/route.ts`

- [ ] **4.1.6** Update `ingest-helpers.ts` to use shared admin client
  - Replace inline `createClient` with import from `lib/supabase/admin`
  - **File:** `ember/src/lib/agents/ingest-helpers.ts`

### 4.2 Create shared createAgentIssue

- [ ] **4.2.1** Add `createAgentIssue` to agent-runtime.ts
  - Shared function: dedup check + insert with `agentName` parameter
  - Use `priority: 1` (fixing C3 permanently)
  - **File:** `ember/src/lib/agents/agent-runtime.ts`

- [ ] **4.2.2** Migrate all agents to shared createAgentIssue
  - Replace 7 private `create*Issue` functions with import from `agent-runtime`
  - **Files:** All 7 agent files

### 4.3 Create shared date utilities

- [ ] **4.3.1** Create `lib/dates.ts` with shared date helpers
  - Functions: `daysAgo(n)`, `todayUTC()`, `toLocalDate(date, tz)`, `getCurrentWeekStart()`
  - **New file:** `ember/src/lib/dates.ts`

- [ ] **4.3.2** Migrate agent files to use `lib/dates.ts`
  - Replace inline `thirtyDaysAgo` calculations in 7 agent files
  - Move `toLocalDate` from `ea-briefing.ts` to `dates.ts`

### 4.4 Create shared isSimilarTitle

- [ ] **4.4.1** Create `lib/suggestion-utils.ts` with shared similarity function
  - Extract `isSimilar` from any of the 3 suggestion files
  - **New file:** `ember/src/lib/suggestion-utils.ts`

- [ ] **4.4.2** Migrate suggestion files to shared utility
  - Update: `metric-suggestions.ts`, `todo-suggestions.ts`, `issue-suggestions.ts`

### 4.5 Deduplicate getUserOrganizationId

- [ ] **4.5.1** Export `getUserOrganizationId` from eos.ts and update callers
  - Export the existing function from `lib/eos.ts`
  - Remove copy in `api/eos/vto/route.ts`
  - Update `lib/eos/checkup.ts` to import from `eos.ts`
  - **Files:** `lib/eos.ts`, `api/eos/vto/route.ts`, `lib/eos/checkup.ts`

**Phase 4 Checkpoint:** `npm run typecheck && npm run test && npm run build` pass

---

## Phase 5: Type Safety Improvements

### 5.1 Fix type/schema drift

- [ ] **5.1.1** Add missing columns to `PartnerPreferences` type
  - Add: `grain_refresh_token`, `grain_client_id`, `hubspot_refresh_token`, `hubspot_portal_id`
  - **File:** `ember/src/types/agents.ts`

- [ ] **5.1.2** Update `Database['briefings']` row type for v2 columns
  - Add: `briefing_version`, `is_monday`, `tactical_items`, `strategic_items`, `fyi_item`, `agent_insights`, `agent_work_queue_overflow`
  - **File:** `ember/src/types/database.ts`

### 5.2 Add Zod validation to LLM boundaries

- [ ] **5.2.1** Add Zod schema for Gmail classifier response
  - Validate `category`, `priority`, `action_needed` fields
  - **File:** `ember/src/lib/connectors/gmail-connector.ts`

- [ ] **5.2.2** Add Zod schema for command parser response
  - Validate `command_type`, `item_numbers`, `parameters` fields
  - **File:** `ember/src/lib/agents/command-parser.ts`

### 5.3 Type the Slack event payload

- [ ] **5.3.1** Replace `payload: any` with `SlackEventPayload` interface
  - Define structural type covering `type`, `event`, `team_id`, `challenge`
  - **File:** `ember/src/app/api/agents/events/slack/route.ts`

**Phase 5 Checkpoint:** `npm run typecheck && npm run test && npm run build` pass

---

## Task Log

| Task | Date | Commit |
|------|------|--------|
| 0.1.1-0.1.7 | 2026-03-01 | Phase 0 commit |
| 0.2.1 | 2026-03-01 | Phase 0 commit |
| 0.3.1-0.3.2 | 2026-03-01 | Phase 0 commit |
| 1.1.1-1.5.1 | 2026-03-01 | Phase 1 commit |
| 2.1.1-2.2.4 | 2026-03-01 | Phase 2 commit |
| 3.1.1-3.4.2 | 2026-03-01 | Phase 3 commit |
