# Week 1 Implementation Plan: Ember Agent System

**Date:** February 22, 2026
**Scope:** PRD v2.0 Section 11 — Week 1 Build Plan
**Goal:** Ship the smallest useful version of the EA and one advisory agent within 5 business days. Prove the daily briefing -> Slack interaction -> approval workflow loop works.

---

## Prerequisites (Before Day 1)

These must be completed before development begins:

1. **Vercel Pro upgrade** — Upgrade to Pro plan ($20/mo) for 60-second function timeouts (800s with Fluid Compute). Current free tier's 10s timeout is insufficient for agent runs.
2. **Google Cloud Project** — Existing GCP project (from Supabase Google OAuth). Need to:
   - Enable Gmail API, Google Calendar API in GCP Console
   - Add OAuth scopes: `gmail.readonly`, `gmail.labels`, `calendar.readonly`
   - Configure consent screen (Internal org type avoids Google verification)
   - Add redirect URI for the new Google OAuth callback
3. **Slack App reconfiguration** — Current app is write-only. Need to:
   - Add Event Subscriptions with Request URL pointing to `/api/agents/events/slack`
   - Subscribe to: `message.im`, `reaction_added`, `app_mention`
   - Add Bot Token Scopes: `im:history`, `im:read`, `im:write`, `reactions:read`, `channels:history`, `groups:history`
   - Note: Slack Events API requires a publicly accessible URL, so development requires either Vercel preview deployments or a tunnel (ngrok)
4. **QuickBooks** — Check if current QBO plan supports API access (Plus or Advanced required). If yes, create an Intuit Developer account and register an OAuth app. If no, defer Financial Strategist to Day 5 or use mock data.
5. **Environment variables** — Add to Vercel + `.env.local`:
   ```
   GOOGLE_CLIENT_ID=         (may already exist)
   GOOGLE_CLIENT_SECRET=
   CRON_SECRET=              (openssl rand -hex 32)
   AGENT_DEFAULT_MODEL=claude-sonnet-4-20250514
   AGENT_FAST_MODEL=claude-haiku-4-5-20251001
   ```

---

## Technical Approach

### What We're Building

The Week 1 deliverable is a vertical slice through the entire agent architecture:

```
Data Ingestion → Agent Analysis → EA Synthesis → Slack Delivery → Command Processing → State Update
```

This requires:
- **3 data connectors** (Gmail, Calendar, bidirectional Slack)
- **2 agents** (EA + Financial Strategist)
- **1 orchestration layer** (scheduler + event router)
- **6 new database tables** (agent_definitions, agent_outputs, agent_runs, ingested_data, briefings, partner_preferences)
- **Slack Events API handler** (inbound messages + reactions)
- **Natural language command parser** (Slack reply → structured action)
- **Morning briefing generator** (three-tier format via Slack Block Kit)

### What We're NOT Building in Week 1

- No new Ember UI pages (agent activity, approvals dashboard — Phase 2)
- No HubSpot, Grain, Drive, or Gusto connectors (Weeks 2-3)
- No Marketing, BD, Ops, or Product Innovation agents (Weeks 2-4)
- No pattern detection engine (Phase 2)
- No approval workflow for Zone 2 actions (simplified: all outputs are informational in Week 1)

### Key Architecture Decisions

**Agent Runtime Location:** `ember/src/lib/agents/` — shared runtime invoked by API routes
**Connector Location:** `ember/src/lib/connectors/` — each connector implements a common interface
**API Routes:** `ember/src/app/api/agents/` — new route tree alongside existing `/api/eos/`
**Database:** New Supabase migration `011_create_agent_tables.sql`
**Slack:** Extend existing `ember/src/lib/slack.ts` → refactor into `ember/src/lib/connectors/slack-connector.ts` for bidirectional support. Keep existing `slack.ts` as a thin re-export to avoid breaking existing code.

**Model Selection (Week 1):**
| Task | Model | Rationale |
|------|-------|-----------|
| Morning briefing synthesis | Sonnet | Balances quality and cost for daily generation |
| Email classification/triage | Haiku | Fast, cheap, focused classification |
| Slack command parsing | Haiku | Fast NL parsing |
| Financial analysis | Sonnet | Structured output from QB data |
| Calendar/email entity extraction | Haiku | Lightweight extraction |

**Slack Architecture:** Use `@slack/web-api` WebClient directly (not Bolt) in Next.js API routes. Manual signature verification. Fire-and-forget for async processing to stay within Slack's 3-second acknowledgment window.

---

## Day-by-Day Plan

### Day 1: Foundation + Data Ingestion

**Goal:** Agent database tables, connector infrastructure, Gmail + Calendar pulling data.

**Phase 0 — Database & Scaffolding:**
- Create migration `011_create_agent_tables.sql` with 6 new tables: `agent_definitions`, `agent_outputs`, `agent_runs`, `ingested_data`, `briefings`, `partner_preferences`
- RLS policies: `agent_outputs` org-scoped, `briefings` partner-scoped, `partner_preferences` partner-scoped
- Seed `agent_definitions` with EA and Financial Strategist persona definitions
- Seed `partner_preferences` for Rich (briefing_time: 07:00, timezone: America/New_York)
- Create directory structure: `src/lib/agents/`, `src/lib/connectors/`, `src/app/api/agents/`

**Phase 1 — Connector Infrastructure:**
- Create `DataConnector` interface in `src/lib/connectors/types.ts`
- Create `src/lib/connectors/gmail-connector.ts`:
  - Google OAuth2 client initialization with stored refresh tokens
  - `history.list()` incremental sync with historyId tracking
  - Email classification via Haiku (client/prospect/vendor/internal/newsletter)
  - Entity extraction (people, companies, action items)
  - Write to `ingested_data` table
- Create `src/lib/connectors/calendar-connector.ts`:
  - `events.list()` polling for next 7 days
  - Attendee matching against known contacts
  - Event type classification (client_meeting/internal/l10/1on1)
  - Write to `ingested_data` table

**Phase 2 — Google OAuth Scope Extension:**
- Create `/api/agents/auth/google/route.ts` — OAuth consent flow requesting Gmail + Calendar scopes
- Create `/api/agents/auth/google/callback/route.ts` — Token exchange, store refresh token in `partner_preferences`
- This is separate from the existing Supabase Google OAuth (which only handles auth, not API scopes)

**Phase 3 — Ingestion Cron:**
- Create `/api/agents/cron/data-ingestion/route.ts`
  - CRON_SECRET verification
  - Runs Gmail + Calendar connectors for each partner with stored tokens
  - Writes results to `ingested_data`
- Add to `vercel.json`: `"path": "/api/agents/cron/data-ingestion", "schedule": "*/15 * * * *"`

**Day 1 Acceptance:** Gmail and Calendar connectors can pull data and store normalized records in `ingested_data`. Agent tables exist and are seeded.

---

### Day 2: Morning Briefing V1

**Goal:** EA generates a three-tier briefing from available data and delivers it to Rich's Slack DM.

**Phase 1 — Agent Runtime:**
- Create `src/lib/agents/agent-runtime.ts`:
  - `invokeAgent(invocation)` — loads definition, assembles context, calls Claude, processes output
  - Context assembly: query `ingested_data` + EOS tables based on agent's data sources
  - Output processing: write to `agent_outputs`, log to `agent_runs`
- Create `src/lib/agents/prompt-manager.ts`:
  - `buildSystemPrompt(agentDef, context)` — persona + shared directive + domain data + task
  - Shared strategic directive as constant (from PRD Section 6.2)

**Phase 2 — EA Briefing Logic:**
- Create `src/lib/agents/ea-briefing.ts`:
  - `generateBriefing(partnerId)` — orchestrates briefing generation
  - Queries: today's calendar events, recent emails (last 24h from `ingested_data`), overdue/upcoming EOS items (Rocks, Todos, Scorecard from existing tables), agent outputs from overnight runs
  - Calls Claude Sonnet with structured output (Zod schema for three-tier briefing)
  - Returns: `{ tier1_urgent, tier2_business, tier3_industry, agent_work_queue }`

**Phase 3 — Slack Delivery:**
- Create `src/lib/agents/slack-briefing.ts`:
  - `formatBriefingBlocks(briefing)` — converts briefing data to Slack Block Kit format
  - `deliverBriefing(partnerId, briefing)` — posts to partner's Slack DM
  - Uses existing Slack bot token from `slack_settings` table
  - Stores `slack_message_ts` in `briefings` table for threading replies

**Phase 4 — Morning Briefing Cron:**
- Create `/api/agents/cron/morning-briefing/route.ts`:
  - CRON_SECRET verification
  - For each partner with preferences: generate + deliver briefing
  - Log to `agent_runs`
- Add to `vercel.json`: `"path": "/api/agents/cron/morning-briefing", "schedule": "30 11 * * 1-5"` (6:30 AM ET = 11:30 UTC)

**Day 2 Acceptance:** Rich receives a formatted morning briefing in Slack DM at 7:00 AM with his calendar, overdue EOS items, and any available email highlights. Briefing is stored in `briefings` table.

---

### Day 3: Slack Command Processing

**Goal:** Rich can reply to briefings in natural language and the system responds appropriately.

**Phase 1 — Slack Events API Handler:**
- Create `/api/agents/events/slack/route.ts`:
  - Slack signature verification (manual, not Bolt)
  - URL verification challenge handler
  - Event routing: `message.im` → command processor, `reaction_added` → approval handler
  - Fire-and-forget pattern for async processing
  - Must handle bot message filtering (ignore own messages)
- Install `@slack/web-api` package

**Phase 2 — Command Parser:**
- Create `src/lib/agents/command-parser.ts`:
  - `parseCommand(text, briefingContext)` — uses Haiku to extract structured commands
  - Supported commands (Week 1 subset):
    - `approve [N]` — mark agent output as approved
    - `reject [N]` / `reject [N] — [reason]` — reject with reason
    - `defer [N]` / `defer [N] to [day]` — reschedule
    - `what's the status of [topic]` — ad-hoc query
    - Free-form questions — route to EA for response
  - Returns: `{ command_type, item_numbers, parameters, raw_text }`

**Phase 3 — Command Execution:**
- Create `src/lib/agents/command-executor.ts`:
  - `executeCommand(command, partnerId)` — routes parsed commands to appropriate handlers
  - Approval/reject/defer: update `agent_outputs` status
  - Status queries: invoke EA with targeted context, respond in Slack thread
  - Free-form: invoke EA as conversational agent, respond in thread
- Responses posted as threaded replies to the original briefing message (using stored `slack_message_ts`)

**Phase 4 — Reaction Handling:**
- Handle emoji reactions on briefing items:
  - :white_check_mark: (approve)
  - :pause_button: (defer)
  - :x: (reject)
- Map reactions to command execution

**Day 3 Acceptance:** Rich replies "approve 3, defer 4 to Wednesday" to a briefing and gets a confirmation reply. Emoji reactions on briefing items trigger appropriate state changes. Free-form questions get EA responses in-thread.

---

### Day 4: Financial Strategist V1

**Goal:** QuickBooks data flows into the system, Financial Strategist generates insights that appear in the next morning briefing.

**Contingency:** If QuickBooks API access is not available (wrong QBO plan), use mock financial data seeded into `ingested_data` to prove the agent pipeline works. The connector can be swapped in later.

**Phase 1 — QuickBooks Connector:**
- Install `intuit-oauth` + `quickbooks-node-promise` (or mock if API unavailable)
- Create `src/lib/connectors/quickbooks-connector.ts`:
  - OAuth2 initialization with auto-refresh
  - `pullFinancialData()` — invoices (90 days), payments (30 days), P&L, AR aging
  - Normalize to `ingested_data` format with financial entity extraction
  - Client mapping: QuickBooks customer → Caldera client name
- Create `/api/agents/auth/quickbooks/route.ts` + callback for OAuth flow (if live)

**Phase 2 — Financial Strategist Agent:**
- Seed `agent_definitions` with Financial Strategist persona (from PRD Section 7.2)
- Create `src/lib/agents/financial-strategist.ts`:
  - `runFinancialAnalysis()` — invoked by overnight cron
  - Queries: QuickBooks data from `ingested_data`, Scorecard metrics, existing Issues
  - Produces: margin-by-client analysis, AR aging alerts, cash flow assessment
  - Output format: structured `agent_outputs` with EOS mapping
  - Creates Issues (Zone 1) when thresholds are breached (margin < 30%, AR > 45 days)

**Phase 3 — Overnight Analysis Cron:**
- Create `/api/agents/cron/overnight-analysis/route.ts`:
  - CRON_SECRET verification
  - Runs data ingestion (QuickBooks daily pull)
  - Invokes Financial Strategist
  - Logs all runs to `agent_runs`
- Add to `vercel.json`: `"path": "/api/agents/cron/overnight-analysis", "schedule": "0 9 * * *"` (4:00 AM ET = 09:00 UTC)

**Phase 4 — EA Integration:**
- Update EA briefing logic to include Financial Strategist outputs:
  - Query `agent_outputs` for Financial Strategist's recent analysis
  - Include financial highlights in Tier 2 (business section)
  - Include financial alerts in Tier 1 (urgent) if thresholds breached
  - Include agent-generated Issues in the agent work queue section

**Day 4 Acceptance:** The overnight pipeline runs: QuickBooks data → Financial Strategist analysis → outputs stored. The morning briefing includes financial insights. At least one auto-generated Issue exists if a threshold is breached.

---

### Day 5: Integration Test + Demo

**Goal:** End-to-end loop working, partner feedback collected.

**Phase 1 — End-to-End Verification:**
- Run full overnight pipeline manually: data ingestion → Financial Strategist → EA briefing
- Verify briefing delivery to Slack
- Test command processing (approve, reject, defer, free-form question)
- Test reaction-based approvals
- Verify all `agent_runs` logs are populated correctly
- Verify `agent_outputs` lifecycle (created → pending_review → approved/rejected)

**Phase 2 — Data Quality:**
- Seed realistic EOS data if needed (Rocks with approaching milestones, overdue Todos, Scorecard metrics)
- Ensure briefing has meaningful content across all three tiers
- Verify email and calendar data is classifying correctly

**Phase 3 — Bug Fixes & Polish:**
- Fix issues found during integration testing
- Optimize briefing formatting (Block Kit readability, link formatting)
- Error handling: graceful degradation when a connector fails
- System health: add `#ember-system` channel alert when overnight pipeline fails

**Phase 4 — Demo Prep & Partner Feedback:**
- Prepare demo script showing full loop
- Demo to John and Wade
- Collect feedback: Is the briefing useful? Is the format right? What's missing?
- Document feedback as Issues or Week 2 adjustments

**Day 5 Acceptance Criteria (from PRD):**
- [ ] Rich receives a useful morning briefing in Slack by 7:00 AM
- [ ] Rich can reply in natural language and the system responds appropriately
- [ ] At least one Financial Strategist insight appears in the briefing
- [ ] EOS data (Rock deadlines, overdue To-dos) appears in the briefing
- [ ] The system creates at least one L10 Issue draft from Financial Strategist analysis
- [ ] John and Wade have seen the system and provided feedback

---

## New Dependencies

```bash
# Google APIs
npm install googleapis

# Slack Web API (replaces manual fetch in current slack.ts)
npm install @slack/web-api

# QuickBooks (if API access confirmed)
npm install intuit-oauth quickbooks-node-promise
```

Existing dependencies already in use: `@anthropic-ai/sdk`, `@ai-sdk/anthropic`, `ai` (Vercel AI SDK), `zod`, `openai`, `@supabase/supabase-js`

---

## New Files Created

```
ember/
├── src/
│   ├── app/api/agents/
│   │   ├── cron/
│   │   │   ├── data-ingestion/route.ts
│   │   │   ├── morning-briefing/route.ts
│   │   │   └── overnight-analysis/route.ts
│   │   ├── events/
│   │   │   └── slack/route.ts
│   │   └── auth/
│   │       ├── google/route.ts
│   │       ├── google/callback/route.ts
│   │       ├── quickbooks/route.ts        (if API available)
│   │       └── quickbooks/callback/route.ts
│   ├── lib/
│   │   ├── agents/
│   │   │   ├── agent-runtime.ts
│   │   │   ├── prompt-manager.ts
│   │   │   ├── ea-briefing.ts
│   │   │   ├── slack-briefing.ts
│   │   │   ├── financial-strategist.ts
│   │   │   ├── command-parser.ts
│   │   │   └── command-executor.ts
│   │   └── connectors/
│   │       ├── types.ts
│   │       ├── gmail-connector.ts
│   │       ├── calendar-connector.ts
│   │       ├── slack-connector.ts
│   │       └── quickbooks-connector.ts
│   └── types/
│       └── agents.ts                      (shared agent type definitions)
└── supabase/
    └── migrations/
        └── 011_create_agent_tables.sql
```

---

## Existing Files Modified

| File | Change |
|------|--------|
| `ember/vercel.json` | Add 3 new cron entries |
| `ember/package.json` | Add googleapis, @slack/web-api, intuit-oauth deps |
| `ember/src/lib/slack.ts` | Extract WebClient initialization to be reusable by connectors |

---

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| QuickBooks API unavailable on current plan | Mock data fallback — Financial Strategist works with seeded data |
| Google restricted scopes require verification | Use "Internal" org type in GCP Console — no verification needed |
| Slack Events API needs public URL for dev | Use Vercel preview deployments or ngrok tunnel |
| Overnight cron exceeds Vercel timeout | Fluid Compute on Pro gives 800s; chain if needed |
| Briefing has no useful content on Day 2 | Seed EOS data (Rocks, Todos) to ensure briefing has material |
| Gmail historyId expires (404) | Full sync fallback with fresh historyId bootstrap |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Morning briefing delivery | 7:00 AM ET daily to Rich's Slack DM |
| Slack command response time | < 10 seconds acknowledgment |
| Financial Strategist accuracy | Produces at least 1 actionable insight from QB data |
| End-to-end pipeline | Runs without manual intervention |
| Partner feedback | Positive sentiment from demo |
