# Ember: Task List

## Overview
Executable task list for Ember. Phase 1-7 covers the original MVP (complete). Phase 8+ covers the Agent System (PRD v2.0).

---

## Phases 1-7: EOS Platform MVP (Complete)

All 48 tasks completed. See `docs/archive/v1.0/` for original task definitions.

| Phase | Description | Tasks | Status |
|-------|-------------|-------|--------|
| Phase 1 | Foundation (Auth, DB, Layout) | 10 | Complete |
| Phase 2 | V/TO + Rocks | 9 | Complete |
| Phase 3 | Scorecard + Issues | 8 | Complete |
| Phase 4 | To-dos + L10 Prep | 9 | Complete |
| Phase 5 | Transcript Ingestion | 9 | Complete |
| Phase 6 | EOS Coaching Layer | 7 | Complete |
| Phase 7 | Polish + Launch | 6 | Complete (except 7.2.2-7.2.5 deferred) |

---

## Phase 8: Agent System — Week 1

**Plan:** `docs/plans/week1-agent-system.md`
**Goal:** Ship EA + Financial Strategist agents with daily briefing → Slack interaction → approval workflow loop.

### Day 1: Foundation + Data Ingestion

#### 8.1 Database & Scaffolding

- [x] **8.1.1** Create agent system database migration
  - Create `supabase/migrations/011_create_agent_tables.sql`
  - Tables: `agent_definitions`, `agent_outputs`, `agent_runs`, `ingested_data`, `briefings`, `partner_preferences`
  - RLS policies: `agent_outputs` org-scoped, `briefings` partner-scoped, `partner_preferences` partner-scoped
  - **Files:** `ember/supabase/migrations/011_create_agent_tables.sql`
  - **Acceptance:** Migration runs successfully, all 6 tables exist with RLS enabled

- [x] **8.1.2** Seed agent definitions and partner preferences
  - Seed `agent_definitions` with EA persona (from PRD Section 7.1) and Financial Strategist persona (Section 7.2)
  - Seed `partner_preferences` for Rich (briefing_time: 07:00, timezone: America/New_York)
  - **Files:** `ember/supabase/migrations/011_create_agent_tables.sql` (seed data in same migration)
  - **Depends on:** 8.1.1
  - **Acceptance:** Two agent definitions and one partner preference row exist

- [x] **8.1.3** Create agent system directory structure and shared types
  - Create directories: `src/lib/agents/`, `src/lib/connectors/`, `src/app/api/agents/`
  - Create `src/types/agents.ts` with TypeScript types matching all 6 new tables
  - Create `src/lib/connectors/types.ts` with `DataConnector` interface
  - **Files:** `ember/src/types/agents.ts`, `ember/src/lib/connectors/types.ts`
  - **Acceptance:** Types compile, directory structure exists

#### 8.2 Gmail Connector

- [x] **8.2.1** Install googleapis and create Google OAuth2 client utility
  - `npm install googleapis`
  - Create `src/lib/connectors/google-auth.ts` — OAuth2 client factory using stored refresh tokens from `partner_preferences`
  - **Files:** `ember/src/lib/connectors/google-auth.ts`, `ember/package.json`
  - **Depends on:** 8.1.3
  - **Acceptance:** OAuth2 client initializes with refresh token from DB

- [x] **8.2.2** Build Gmail connector
  - Create `src/lib/connectors/gmail-connector.ts`
  - Implements `DataConnector` interface
  - `history.list()` incremental sync with `historyId` tracking (stored in `partner_preferences`)
  - Full sync fallback when historyId expires (404)
  - Email classification via Haiku: client/prospect/vendor/internal/newsletter
  - Entity extraction: people, companies, action items
  - Writes normalized records to `ingested_data` table
  - **Files:** `ember/src/lib/connectors/gmail-connector.ts`
  - **Depends on:** 8.2.1
  - **Acceptance:** Connector pulls emails and writes classified records to `ingested_data`

#### 8.3 Calendar Connector

- [x] **8.3.1** Build Calendar connector
  - Create `src/lib/connectors/calendar-connector.ts`
  - Implements `DataConnector` interface
  - `events.list()` polling for next 7 days
  - Attendee matching against known contacts
  - Event type classification: client_meeting/internal/l10/1on1
  - Writes to `ingested_data` table
  - **Files:** `ember/src/lib/connectors/calendar-connector.ts`
  - **Depends on:** 8.2.1 (shared Google auth)
  - **Acceptance:** Connector pulls calendar events and writes classified records to `ingested_data`

#### 8.4 Google OAuth Flow

- [x] **8.4.1** Create Google OAuth consent and callback routes
  - Create `/api/agents/auth/google/route.ts` — initiates OAuth consent requesting `gmail.readonly` + `calendar.readonly` scopes
  - Create `/api/agents/auth/google/callback/route.ts` — exchanges code for tokens, stores refresh token in `partner_preferences`
  - Separate from existing Supabase Google OAuth (which only handles auth)
  - **Files:** `ember/src/app/api/agents/auth/google/route.ts`, `ember/src/app/api/agents/auth/google/callback/route.ts`
  - **Depends on:** 8.1.1, 8.2.1
  - **Acceptance:** OAuth flow completes, refresh token stored in DB

#### 8.5 Data Ingestion Cron

- [x] **8.5.1** Create data ingestion cron route
  - Create `/api/agents/cron/data-ingestion/route.ts`
  - `CRON_SECRET` verification
  - Runs Gmail + Calendar connectors for each partner with stored tokens
  - Skips partners without Google tokens (graceful no-op)
  - Writes results to `ingested_data`
  - **Files:** `ember/src/app/api/agents/cron/data-ingestion/route.ts`
  - **Depends on:** 8.2.2, 8.3.1
  - **Acceptance:** Cron route callable, runs both connectors, logs results

- [x] **8.5.2** Register data ingestion cron in vercel.json
  - Add `"/api/agents/cron/data-ingestion"` with schedule `"*/15 * * * *"` (every 15 min)
  - **Files:** `ember/vercel.json`
  - **Depends on:** 8.5.1
  - **Acceptance:** `vercel.json` has 3 cron entries (2 existing + 1 new)

**Day 1 Checkpoint:** Gmail and Calendar connectors pull data into `ingested_data`. Agent tables exist and are seeded. Google OAuth flow works.

---

### Day 2: Morning Briefing V1

#### 8.6 Agent Runtime

- [x] **8.6.1** Create agent runtime core
  - Create `src/lib/agents/agent-runtime.ts`
  - `invokeAgent(invocation)` — loads agent definition from DB, assembles context, calls Claude, processes output
  - Context assembly: queries `ingested_data` + EOS tables based on agent's configured data sources
  - Output processing: writes to `agent_outputs`, logs to `agent_runs`
  - Model selection based on task type (Sonnet for synthesis, Haiku for parsing)
  - **Files:** `ember/src/lib/agents/agent-runtime.ts`
  - **Depends on:** 8.1.1, 8.1.3
  - **Acceptance:** Runtime can invoke an agent and produce structured output

- [x] **8.6.2** Create prompt manager
  - Create `src/lib/agents/prompt-manager.ts`
  - `buildSystemPrompt(agentDef, context)` — assembles persona + shared strategic directive + domain data + task
  - Shared strategic directive as constant (from PRD Section 6.2)
  - Context injection: EOS data summaries, recent ingested data, partner profile
  - **Files:** `ember/src/lib/agents/prompt-manager.ts`
  - **Depends on:** 8.6.1
  - **Acceptance:** System prompts generate correctly with injected context

#### 8.7 EA Briefing Logic

- [x] **8.7.1** Build EA briefing generator
  - Create `src/lib/agents/ea-briefing.ts`
  - `generateBriefing(partnerId)` — orchestrates full briefing generation
  - Queries: today's calendar events, recent emails (24h from `ingested_data`), overdue/upcoming EOS items (Rocks, Todos, Scorecard), agent outputs from overnight runs
  - Calls Claude Sonnet with Zod-validated structured output
  - Returns: `{ tier1_urgent, tier2_business, tier3_industry, agent_work_queue }`
  - **Files:** `ember/src/lib/agents/ea-briefing.ts`
  - **Depends on:** 8.6.1, 8.6.2
  - **Acceptance:** Generates three-tier briefing from available data

#### 8.8 Slack Briefing Delivery

- [x] **8.8.1** Install @slack/web-api and create Slack connector
  - `npm install @slack/web-api`
  - Create `src/lib/connectors/slack-connector.ts` — WebClient wrapper
  - Refactor existing `src/lib/slack.ts` to import from connector (thin re-export, no breaking changes)
  - **Files:** `ember/src/lib/connectors/slack-connector.ts`, `ember/src/lib/slack.ts`, `ember/package.json`
  - **Depends on:** 8.1.3
  - **Acceptance:** WebClient works, existing Slack functionality unbroken

- [x] **8.8.2** Build Slack Block Kit briefing formatter
  - Create `src/lib/agents/slack-briefing.ts`
  - `formatBriefingBlocks(briefing)` — converts three-tier briefing to Slack Block Kit JSON
  - Tier 1 items: red emoji, bold text, numbered for quick reference
  - Tier 2 items: categorized by type (calendar, EOS, financial)
  - Tier 3 items: collapsed/minimal
  - Agent work queue: numbered items with approve/reject hint
  - **Files:** `ember/src/lib/agents/slack-briefing.ts`
  - **Depends on:** 8.7.1
  - **Acceptance:** Block Kit output renders correctly in Slack

- [x] **8.8.3** Build briefing delivery function
  - Add `deliverBriefing(partnerId, briefing)` to `slack-briefing.ts`
  - Posts to partner's Slack DM channel (looks up from `profiles.slack_user_id`)
  - Stores `slack_message_ts` and `slack_channel_id` in `briefings` table for threading replies later
  - **Files:** `ember/src/lib/agents/slack-briefing.ts`
  - **Depends on:** 8.8.1, 8.8.2
  - **Acceptance:** Briefing posts to Rich's Slack DM, message_ts stored in DB

#### 8.9 Morning Briefing Cron

- [x] **8.9.1** Create morning briefing cron route
  - Create `/api/agents/cron/morning-briefing/route.ts`
  - `CRON_SECRET` verification
  - For each partner with preferences: run data ingestion → generate briefing → deliver via Slack
  - Log to `agent_runs`
  - **Files:** `ember/src/app/api/agents/cron/morning-briefing/route.ts`
  - **Depends on:** 8.7.1, 8.8.3
  - **Acceptance:** Cron route generates and delivers briefing

- [x] **8.9.2** Register morning briefing cron in vercel.json
  - Add `"/api/agents/cron/morning-briefing"` with schedule `"30 11 * * 1-5"` (6:30 AM ET weekdays)
  - **Files:** `ember/vercel.json`
  - **Depends on:** 8.9.1
  - **Acceptance:** `vercel.json` has 4 cron entries

**Day 2 Checkpoint:** Rich receives formatted morning briefing in Slack DM with calendar, EOS items, and email highlights. Briefing stored in `briefings` table.

---

### Day 3: Slack Command Processing

> **Note:** Slack Events API settings (Event Subscriptions URL, event types) cannot be saved in the Slack App config until the `/api/agents/events/slack` route is deployed and responding to Slack's URL verification challenge. Deploy the route first, then configure Slack.

#### 8.10 Slack Events API Handler

- [x] **8.10.1** Create Slack events webhook route
  - Create `/api/agents/events/slack/route.ts`
  - Slack request signature verification (manual HMAC, not Bolt)
  - URL verification challenge handler (responds to Slack's `url_verification` event)
  - Event routing: `message.im` → command processor, `reaction_added` → approval handler
  - Bot message filtering (ignore own messages via `bot_id` check)
  - Fire-and-forget pattern: acknowledge within 3 seconds, process asynchronously
  - **Files:** `ember/src/app/api/agents/events/slack/route.ts`
  - **Depends on:** 8.8.1
  - **Acceptance:** Route responds to Slack challenge, receives events, routes correctly

- [ ] **8.10.2** Deploy and configure Slack Events API
  - Deploy to Vercel (preview or production)
  - In Slack App config: enable Event Subscriptions, set Request URL to deployed `/api/agents/events/slack`
  - Subscribe to events: `message.im`, `reaction_added`, `app_mention`
  - Reinstall app to workspace
  - **Depends on:** 8.10.1
  - **Acceptance:** Slack Events API verified, events flowing to route

#### 8.11 Command Parser

- [x] **8.11.1** Build natural language command parser
  - Create `src/lib/agents/command-parser.ts`
  - `parseCommand(text, briefingContext)` — uses Haiku to extract structured commands
  - Supported commands (Week 1):
    - `approve [N]` — mark agent output approved
    - `reject [N]` / `reject [N] — [reason]` — reject with reason
    - `defer [N]` / `defer [N] to [day]` — reschedule
    - `what's the status of [topic]` — ad-hoc query
    - Free-form questions — route to EA
  - Returns: `{ command_type, item_numbers, parameters, raw_text }`
  - **Files:** `ember/src/lib/agents/command-parser.ts`
  - **Depends on:** 8.1.3
  - **Acceptance:** Parser correctly classifies test commands

#### 8.12 Command Execution

- [x] **8.12.1** Build command executor
  - Create `src/lib/agents/command-executor.ts`
  - `executeCommand(command, partnerId)` — routes parsed commands to handlers
  - Approval/reject/defer: update `agent_outputs` status field
  - Status queries: invoke EA with targeted context, respond in Slack thread
  - Free-form: invoke EA as conversational agent, respond in thread
  - All responses posted as threaded replies using stored `slack_message_ts` from `briefings`
  - **Files:** `ember/src/lib/agents/command-executor.ts`
  - **Depends on:** 8.11.1, 8.6.1, 8.8.1
  - **Acceptance:** Commands execute correctly, Slack thread replies work

#### 8.13 Reaction Handling

- [x] **8.13.1** Implement emoji reaction approvals
  - Handle `reaction_added` events from Slack
  - Map reactions to commands: `:white_check_mark:` → approve, `:pause_button:` → defer, `:x:` → reject
  - Identify which briefing item was reacted to (match message_ts to briefing)
  - Route through command executor
  - **Files:** `ember/src/app/api/agents/events/slack/route.ts` (extend), `ember/src/lib/agents/command-executor.ts` (extend)
  - **Depends on:** 8.10.1, 8.12.1
  - **Acceptance:** Emoji reactions on briefing items trigger state changes

**Day 3 Checkpoint:** Rich replies "approve 3, defer 4 to Wednesday" and gets confirmation. Emoji reactions work. Free-form questions get EA responses in-thread.

---

### Day 4: Financial Strategist V1

> **Contingency:** If QuickBooks API access is unavailable (wrong QBO plan), seed mock financial data into `ingested_data` and skip 8.14.1-8.14.2. The Financial Strategist agent works the same either way.

#### 8.14 QuickBooks Connector

- [x] **8.14.1** Install QuickBooks dependencies and create OAuth flow
  - `npm install intuit-oauth quickbooks-node-promise` (skip if using mock data)
  - Create `/api/agents/auth/quickbooks/route.ts` + callback
  - Store refresh token in `partner_preferences`
  - **Files:** `ember/src/app/api/agents/auth/quickbooks/route.ts`, `ember/src/app/api/agents/auth/quickbooks/callback/route.ts`, `ember/package.json`
  - **Depends on:** 8.1.1
  - **Acceptance:** OAuth flow completes, tokens stored

- [x] **8.14.2** Build QuickBooks connector
  - Create `src/lib/connectors/quickbooks-connector.ts`
  - Implements `DataConnector` interface
  - `pullFinancialData()` — invoices (90 days), payments (30 days), P&L summary, AR aging
  - Auto-refresh of hourly tokens
  - Client mapping: QuickBooks customer names → Caldera client names
  - Normalize to `ingested_data` format
  - **Files:** `ember/src/lib/connectors/quickbooks-connector.ts`
  - **Depends on:** 8.14.1
  - **Acceptance:** Connector pulls financial data and writes to `ingested_data`

#### 8.15 Financial Strategist Agent

- [x] **8.15.1** Build Financial Strategist agent
  - Create `src/lib/agents/financial-strategist.ts`
  - `runFinancialAnalysis()` — invoked by overnight cron
  - Queries: QuickBooks data from `ingested_data`, Scorecard metrics, existing Issues
  - Produces: margin-by-client analysis, AR aging alerts, cash flow assessment
  - Output format: structured `agent_outputs` with EOS entity mapping
  - Zone 1 auto-actions: creates Issues when thresholds breached (margin < 30%, AR > 45 days)
  - Uses Claude Sonnet for analysis
  - **Files:** `ember/src/lib/agents/financial-strategist.ts`
  - **Depends on:** 8.6.1, 8.1.2
  - **Acceptance:** Agent produces structured financial insights, creates Issues for threshold breaches

#### 8.16 Overnight Analysis Pipeline

- [x] **8.16.1** Create overnight analysis cron route
  - Create `/api/agents/cron/overnight-analysis/route.ts`
  - `CRON_SECRET` verification
  - Runs QuickBooks data ingestion (daily pull)
  - Invokes Financial Strategist agent
  - Logs all runs to `agent_runs`
  - **Files:** `ember/src/app/api/agents/cron/overnight-analysis/route.ts`
  - **Depends on:** 8.14.2 (or mock data), 8.15.1
  - **Acceptance:** Pipeline runs end-to-end, outputs stored

- [x] **8.16.2** Register overnight analysis cron in vercel.json
  - Add `"/api/agents/cron/overnight-analysis"` with schedule `"0 9 * * *"` (4:00 AM ET)
  - **Files:** `ember/vercel.json`
  - **Depends on:** 8.16.1
  - **Acceptance:** `vercel.json` has 5 cron entries

#### 8.17 EA Integration with Financial Strategist

- [x] **8.17.1** Update EA briefing to include Financial Strategist outputs
  - Update `ea-briefing.ts` to query `agent_outputs` for Financial Strategist's recent analysis
  - Include financial alerts in Tier 1 (urgent) when thresholds breached
  - Include financial highlights in Tier 2 (business section)
  - Include agent-generated Issues in agent work queue section
  - **Files:** `ember/src/lib/agents/ea-briefing.ts`
  - **Depends on:** 8.15.1, 8.7.1
  - **Acceptance:** Morning briefing includes financial insights and auto-generated Issues

**Day 4 Checkpoint:** Overnight pipeline runs QuickBooks → Financial Strategist → stored outputs. Morning briefing includes financial insights. At least one auto-generated Issue exists.

---

### Day 5: Integration Test + Demo

#### 8.18 End-to-End Verification

- [x] **8.18.1** Run full pipeline manually and verify
  - Trigger data ingestion manually (Gmail + Calendar + QuickBooks)
  - Trigger overnight analysis (Financial Strategist)
  - Trigger morning briefing generation + delivery
  - Verify Slack DM received with all three tiers populated
  - Test command processing: approve, reject, defer, free-form question
  - Test reaction-based approvals
  - Verify `agent_runs` logs populated correctly
  - Verify `agent_outputs` lifecycle: created → pending_review → approved/rejected
  - **Depends on:** All Day 1-4 tasks
  - **Acceptance:** Full loop works without manual intervention

#### 8.19 Data Quality

- [x] **8.19.1** Seed realistic EOS data for demo
  - Ensure Rocks with approaching milestones exist
  - Ensure overdue Todos exist
  - Ensure Scorecard metrics have recent data
  - Ensure briefing has meaningful content across all three tiers
  - Verify email and calendar classification accuracy
  - **Depends on:** 8.18.1
  - **Acceptance:** Briefing contains compelling, realistic content

#### 8.20 Bug Fixes & Polish

- [x] **8.20.1** Fix integration issues and add error handling
  - Fix bugs found during integration testing
  - Optimize Block Kit formatting (readability, link formatting)
  - Add graceful degradation when a connector fails (skip, don't crash)
  - Add `#ember-system` Slack channel alert when overnight pipeline fails
  - **Depends on:** 8.18.1
  - **Acceptance:** Pipeline handles connector failures gracefully, system alerts work

#### 8.21 Demo & Feedback

- [x] **8.21.1** Demo to partners and collect feedback
  - Prepare demo script showing full loop
  - Demo to John and Wade
  - Collect feedback: Is the briefing useful? Format right? What's missing?
  - Document feedback as Issues or Week 2 adjustments
  - **Depends on:** 8.19.1, 8.20.1
  - **Acceptance:** Partners have seen the system, feedback documented

**Day 5 Acceptance Criteria (from PRD):**
- [ ] Rich receives a useful morning briefing in Slack by 7:00 AM
- [ ] Rich can reply in natural language and the system responds appropriately
- [ ] At least one Financial Strategist insight appears in the briefing
- [ ] EOS data (Rock deadlines, overdue To-dos) appears in the briefing
- [ ] The system creates at least one L10 Issue draft from Financial Strategist analysis
- [ ] John and Wade have seen the system and provided feedback

---

## Phase 9: Agent System — Week 2 (Briefing Excellence + HubSpot)

**Plan:** `docs/plans/phase2-impactful-agents.md`
**Goal:** Transform the morning briefing from a demo into a tool Rich relies on daily. Get HubSpot pipeline data flowing. Build a settings page for connector management.

### Week 2, Days 1-2: Briefing Excellence

#### 9.1 Improve EA Briefing Quality

- [x] **9.1.1** Enhance EA briefing data assembly
  - Expand calendar lookahead from 1 day to 7 days (with today prioritized)
  - Add Scorecard trend data (last 4 weeks, highlight consecutive misses)
  - Add Rock milestone progress (% complete, days until due)
  - Include To-do completion rate (last 2 weeks)
  - **Files:** `ember/src/lib/agents/ea-briefing.ts`
  - **Acceptance:** Briefing context includes richer EOS data across multiple dimensions

- [x] **9.1.2** Improve briefing prompt engineering
  - Add Caldera-specific context to the EA prompt (company profile, partner roles, strategic priorities)
  - Make briefing items actionable ("Reply 'approve 3' to approve" → specific suggested actions)
  - Reduce generic filler, increase specificity (dollar amounts, client names, dates)
  - Add partner role awareness (Rich sees cross-functional view, financial emphasis)
  - **Files:** `ember/src/lib/agents/prompt-manager.ts`, `ember/src/lib/agents/ea-briefing.ts`
  - **Depends on:** 9.1.1
  - **Acceptance:** Briefing items are specific, actionable, and Caldera-contextualized

- [x] **9.1.3** Polish Slack Block Kit formatting
  - Improve scannability: shorter text per item, clearer hierarchy
  - Add deep links to Ember dashboard for items that need detailed review
  - Add time-of-day greeting ("Good morning, Rich")
  - Add brief "What Ember did overnight" summary (data pulled, analyses run)
  - Compact agent work queue with inline approve/reject hints
  - **Files:** `ember/src/lib/agents/slack-briefing.ts`
  - **Depends on:** 9.1.2
  - **Acceptance:** Briefing is scannable in <60 seconds, actions are obvious

#### 9.2 Financial Strategist Enrichment

- [x] **9.2.1** Enrich Financial Strategist output for briefing integration
  - Include specific dollar amounts in analysis summary (not just "margins are concerning")
  - Add week-over-week trend indicators (↑↓→) for key financial metrics
  - Generate a one-line "Financial headline" for Tier 1 or Tier 2
  - Improve Issue creation with richer context (data points, recommended next step)
  - **Files:** `ember/src/lib/agents/financial-strategist.ts`, `ember/src/lib/agents/ea-briefing.ts`
  - **Acceptance:** Financial insights in briefing include concrete numbers and trend direction

### Week 2, Days 3-5: HubSpot Integration

#### 9.3 HubSpot Connector

- [x] **9.3.1** Install HubSpot SDK and create OAuth flow
  - `npm install @hubspot/api-client`
  - Create `/api/agents/auth/hubspot/route.ts` — OAuth consent flow requesting `crm.objects.deals.read`, `crm.objects.contacts.read`, `crm.objects.companies.read` scopes
  - Create `/api/agents/auth/hubspot/callback/route.ts` — Token exchange, store refresh token in `partner_preferences`
  - Add `hubspot_refresh_token` and `hubspot_portal_id` columns to `partner_preferences` (migration 012)
  - **Files:** `ember/src/app/api/agents/auth/hubspot/route.ts`, `ember/src/app/api/agents/auth/hubspot/callback/route.ts`, `ember/supabase/migrations/012_add_hubspot_columns.sql`
  - **Acceptance:** OAuth flow completes, tokens stored in DB

- [x] **9.3.2** Build HubSpot connector
  - Create `src/lib/connectors/hubspot-connector.ts`
  - Implements `DataConnector` interface
  - Pulls: active deals (with stage, amount, close date, owner), companies, contacts
  - Pipeline stage mapping and deal velocity calculation
  - Normalize to `ingested_data` format with entity extraction
  - **Files:** `ember/src/lib/connectors/hubspot-connector.ts`
  - **Depends on:** 9.3.1
  - **Acceptance:** Connector pulls HubSpot deals/contacts and writes to `ingested_data`

- [x] **9.3.3** Add HubSpot to data ingestion cron
  - Extend data ingestion cron to run HubSpot connector (30-min polling, separate from Gmail/Calendar 15-min)
  - Graceful skip if no HubSpot tokens stored
  - **Files:** `ember/src/app/api/agents/cron/data-ingestion/route.ts`
  - **Depends on:** 9.3.2
  - **Acceptance:** HubSpot data flows into `ingested_data` on cron schedule

- [x] **9.3.4** Add pipeline data to EA briefing
  - Query HubSpot deals from `ingested_data` in briefing data assembly
  - Add pipeline summary to Tier 2 (total pipeline value, deals closing this week, stalled deals)
  - Add urgent deal alerts to Tier 1 (deals closing today, overdue follow-ups)
  - **Files:** `ember/src/lib/agents/ea-briefing.ts`
  - **Depends on:** 9.3.3
  - **Acceptance:** Morning briefing includes HubSpot pipeline summary

#### 9.4 Settings & Integrations Page

- [x] **9.4.1** Build integrations settings page
  - Create `/dashboard/settings/integrations/page.tsx`
  - Show connector status cards: Google (Gmail + Calendar), Slack, HubSpot, QuickBooks
  - Each card shows: connected/disconnected, last sync time, connect/disconnect button
  - Connect buttons link to respective OAuth flows
  - **Files:** `ember/src/app/dashboard/settings/integrations/page.tsx`, `ember/src/components/dashboard/IntegrationCard.tsx`
  - **Depends on:** 9.3.1
  - **Acceptance:** Page renders connector status, OAuth flows launchable from UI

- [x] **9.4.2** Build API route for connector status
  - Create `/api/agents/status/route.ts` — returns connector status for current user's org
  - Checks: Google tokens present, Slack bot_token present, HubSpot tokens present, QB tokens present
  - Returns last ingestion timestamps from `ingested_data`
  - **Files:** `ember/src/app/api/agents/status/route.ts`
  - **Depends on:** 9.4.1
  - **Acceptance:** Status API returns accurate connector state

**Week 2 Checkpoint:**
- [ ] Rich rates morning briefing 7+/10 for usefulness
- [ ] HubSpot connector pulls real deal/pipeline data
- [ ] Pipeline summary appears in morning briefing
- [ ] Settings page shows connector status and allows OAuth flows

---

## Phase 10: Agent System — Week 3 (Grain MCP + BD Strategist + Nudges)

**Plan:** `docs/plans/grain-mcp-integration-upgrade.md` (Grain), `docs/plans/phase10-week3-intelligence.md` (BD Strategist, Nudges, L10)
**Goal:** Automate Grain transcript ingestion via MCP Connector API, leverage Grain AI notes to reduce LLM costs, activate the BD Strategist for John, build the proactive nudge system, and wire L10 meeting prep into the agent system.

### Days 1-2: Grain MCP Automated Ingestion

**Architecture:** Use the [Anthropic MCP Connector API](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector) (beta: `mcp-client-2025-11-20`) to call Grain's MCP server directly from our Vercel cron. Claude Haiku routes tool calls at ~$0.01/run. Grain's AI-generated notes replace our expensive LLM extraction pipeline for meetings where notes are available.

**Plan:** `docs/plans/grain-mcp-integration-upgrade.md`

#### 10.1 Grain MCP Credentials & Client

- [x] **10.1.1** Obtain Grain MCP server URL and OAuth token
  - Run MCP Inspector: `npx @modelcontextprotocol/inspector`
  - Select SSE/Streamable HTTP transport, point to Grain's MCP server
  - Complete OAuth flow to obtain `access_token`
  - Store as environment variables: `GRAIN_MCP_URL`, `GRAIN_MCP_TOKEN`
  - Add both to `.env.local` and Vercel project environment variables
  - **Acceptance:** MCP Inspector shows Grain tools accessible with obtained token

- [x] **10.1.2** Build Grain MCP client wrapper
  - Create `src/lib/connectors/grain-mcp-client.ts`
  - Install `@anthropic-ai/sdk` if not already present
  - Typed wrapper around `anthropic.beta.messages.create()` with Grain MCP server
  - Methods: `listMeetings(since?)`, `fetchTranscript(id)`, `fetchNotes(id)`, `fetchCoaching(id)`
  - Each method sends a structured prompt to Haiku with Grain MCP toolset attached
  - Parses Claude's tool-use response into typed return values
  - Uses beta header: `mcp-client-2025-11-20`
  - Model: `claude-haiku-4-5-20251001` (cheapest, sufficient for tool routing)
  - Types: `GrainMeeting`, `GrainTranscript`, `GrainNotes`, `GrainCoaching`
  - **Files:** `ember/src/lib/connectors/grain-mcp-client.ts`
  - **Depends on:** 10.1.1
  - **Acceptance:** Client wrapper can list meetings and fetch transcripts/notes from Grain

#### 10.2 Grain Notes Parser & Extraction Shortcut

- [x] **10.2.1** Build Grain notes → Ember extractions parser
  - Create `src/lib/connectors/grain-notes-parser.ts`
  - `parseGrainNotes(notes: string): EmberExtractions` — deterministic parsing, no LLM
  - Parses Grain's markdown-formatted notes (confirmed structure from POC):
    - `## Section Header` → topics
    - `- [ ] **Owner** will: task` → todos with owner
    - `## Action Items` section → todos
    - Dollar amounts (`$10,000`, `$600K`) → metrics
    - Named people and companies → entities
  - Maps to Ember's `extractions` JSONB format: `{ issues, todos, decisions, rocks, metrics, summary }`
  - **Files:** `ember/src/lib/connectors/grain-notes-parser.ts`
  - **Acceptance:** Parser correctly extracts todos, issues, and entities from sample Grain notes

- [x] **10.2.2** Short-circuit transcript processing when Grain notes available
  - Modify `src/app/api/eos/transcripts/[id]/process/route.ts`
  - If `transcript.extractions` is already populated (from Grain notes mapping):
    - **Skip** steps 3-5 (chunk extraction, merge, summary) — saves 3-5 Claude API calls
    - **Keep** steps 1-2 (chunking + embedding) — still needed for semantic search
    - **Keep** suggestion generation (metrics, todos, issues) — uses existing extractions
  - Add `grain_notes_used: boolean` to processing response for monitoring
  - **Files:** `ember/src/app/api/eos/transcripts/[id]/process/route.ts`
  - **Depends on:** 10.2.1
  - **Acceptance:** Processing route skips LLM extraction when extractions pre-populated, embeddings still generated

#### 10.3 Automated Grain Ingestion Cron

- [x] **10.3.1** Rewrite transcript ingestion cron to pull from Grain MCP
  - Modify `src/app/api/agents/cron/ingest/transcripts/route.ts`
  - New flow:
    1. Call `grainMcpClient.listMeetings(since: grain_last_sync)` to discover new meetings
    2. For each new meeting:
       a. Fetch transcript via `grainMcpClient.fetchTranscript(id)`
       b. Fetch AI notes via `grainMcpClient.fetchNotes(id)`
       c. If notes available: parse with `parseGrainNotes()` → pre-populate `extractions`
       d. Upsert to `transcripts` table with `source: 'grain'`
       e. Trigger processing pipeline (which will skip LLM extraction if extractions exist)
    3. Run existing transcript-connector for `ingested_data` pipeline
    4. Update `grain_last_sync` timestamp
  - Classify meetings using existing `classifyMeeting()` from transcript-connector
  - **Files:** `ember/src/app/api/agents/cron/ingest/transcripts/route.ts`
  - **Depends on:** 10.1.2, 10.2.1, 10.2.2
  - **Acceptance:** New Grain meetings auto-ingested every 6 hours, Grain notes used when available

- [x] **10.3.2** Add transcript highlights to EA briefing
  - Update `ea-briefing.ts` to query recent transcript summaries (last 48 hours)
  - Filter by partner-relevant tags (Rich: `l10, leadership, 1on1`; John: `sales, prospect, client`)
  - Include key points and action items from recent meetings in briefing context
  - Add "Yesterday's Meetings" section to Tier 2 briefing items
  - Use `ORDER BY source_timestamp DESC` with time window filtering
  - **Files:** `ember/src/lib/agents/ea-briefing.ts`
  - **Depends on:** 10.3.1
  - **Acceptance:** Morning briefing includes highlights from previous day's meetings

### Days 3-4: BD Strategist + Pre-Meeting Prep

#### 10.4 BD Strategist Agent

- [x] **10.4.1** Seed BD Strategist agent definition and John's partner preferences
  - Create migration `014_seed_bd_strategist.sql`
  - Seed `agent_definitions` with BD Strategist persona (from PRD Section 7.4 — VP of Partnerships, proactive, opportunity-seeking)
  - Seed `partner_preferences` for John (briefing_time: 07:30, timezone: America/Chicago, focus_areas: ['sales', 'pipeline', 'clients'])
  - Seed `partner_preferences` for Wade (briefing_time: 07:00, timezone: America/Chicago, focus_areas: ['delivery', 'engineering', 'clients'])
  - **Files:** `ember/supabase/migrations/014_seed_bd_strategist.sql`
  - **Acceptance:** BD Strategist agent definition exists, John and Wade have partner preferences

- [x] **10.4.2** Build BD Strategist analysis module
  - Create `src/lib/agents/bd-strategist.ts`
  - `runPipelineAnalysis(organizationId)` — overnight analysis function
  - Queries: HubSpot deals from `ingested_data` (last 30 days), recent sales-tagged transcripts (last 30 days), deal stage distribution, velocity metrics
  - Produces structured output via Zod schema:
    - `headline`: one-line pipeline summary
    - `pipeline_health`: total value, deal count, avg velocity, stage distribution
    - `deals_at_risk`: overdue close dates, stalled deals (no activity 14+ days)
    - `closing_this_week`: deals with close date within 7 days
    - `win_loss_summary`: recent closed deals and patterns
    - `eos_actions`: auto-create Issues for pipeline risks (e.g., stalled high-value deals)
  - Uses Claude Sonnet for analysis
  - **Files:** `ember/src/lib/agents/bd-strategist.ts`
  - **Depends on:** 10.4.1
  - **Acceptance:** BD Strategist generates structured pipeline analysis from HubSpot data

- [x] **10.4.3** Add BD Strategist to overnight analysis cron
  - Extend `overnight-analysis/route.ts` to invoke BD Strategist per organization
  - Run after Financial Strategist (both feed into morning briefing)
  - Log to `agent_runs` table
  - Include BD Strategist outputs in EA briefing assembly
  - Update `ea-briefing.ts` to query BD Strategist `agent_outputs` and include pipeline insights in Tier 2
  - **Files:** `ember/src/app/api/agents/cron/overnight-analysis/route.ts`, `ember/src/lib/agents/ea-briefing.ts`
  - **Depends on:** 10.4.2
  - **Acceptance:** BD Strategist runs overnight, outputs appear in morning briefing pipeline section

#### 10.5 Pre-Meeting Prep

- [x] **10.5.1** Build pre-meeting intelligence generator
  - Create `src/lib/agents/meeting-prep.ts`
  - `generatePreCallBrief(meetingEvent, organizationId)` — compile context for an upcoming external meeting
  - Queries per-client data: `relevance_tags @> '{client:{name}}' ORDER BY source_timestamp DESC LIMIT 3`
  - Assembles: HubSpot deal status, recent email threads with this contact, prior meeting notes, open action items
  - Generates focused 5-line prep brief via Claude Haiku (fast, cheap — runs per meeting)
  - Format as Slack Block Kit for DM delivery
  - **Files:** `ember/src/lib/agents/meeting-prep.ts`
  - **Depends on:** 10.3.2, 10.4.3
  - **Acceptance:** Pre-call brief generated with client context from multiple sources

- [x] **10.5.2** Wire pre-meeting prep into morning briefing cron
  - Extend `morning-briefing/route.ts` to check for external meetings in next 4 hours
  - For each external/client meeting, call `generatePreCallBrief()`
  - Deliver as separate Slack DM to the partner attending (not part of main briefing)
  - If John has a sales call at 10am, he gets a prep DM at ~7:30am
  - Match meeting attendees to HubSpot contacts/companies for client identification
  - **Files:** `ember/src/app/api/agents/cron/morning-briefing/route.ts`, `ember/src/lib/agents/meeting-prep.ts`
  - **Depends on:** 10.5.1
  - **Acceptance:** Partners receive pre-call prep DMs before external meetings

### Days 4-5: Nudge System + L10 Prep

#### 10.6 Proactive Nudge System

- [x] **10.6.1** Build nudge engine
  - Create `src/lib/agents/nudge-engine.ts`
  - `runNudgeCheck(organizationId)` — evaluates all overdue/stalled EOS items
  - Detection rules:
    - Overdue To-dos (past 7-day deadline)
    - Stalled Rocks (no milestone progress in 2+ weeks)
    - Missed Scorecard entries (3+ consecutive weeks without entry)
    - Rock milestones due within 3 days
  - Three escalation levels per ADR-009:
    1. Gentle reminder (first occurrence) — Slack DM
    2. Direct nudge (2nd+ occurrence) — Slack DM with data
    3. L10 escalation (3rd+ week) — auto-create Issue for group discussion
  - Track nudge history via `agent_outputs` (type: `alert`) to determine escalation level
  - Max 1 nudge per item per day, no weekend nudges
  - **Files:** `ember/src/lib/agents/nudge-engine.ts`
  - **Acceptance:** Nudge engine detects overdue items and assigns correct escalation level

- [x] **10.6.2** Wire nudge engine into morning briefing cron and deliver via Slack
  - Extend `morning-briefing/route.ts` to run nudge check before briefing generation
  - Deliver nudges as individual Slack DMs to each partner (separate from briefing)
  - Store nudge outputs in `agent_outputs` for history tracking
  - Format nudges with appropriate tone per escalation level
  - Include relevant data (days overdue, last update date, completion %)
  - **Files:** `ember/src/app/api/agents/cron/morning-briefing/route.ts`, `ember/src/lib/agents/nudge-engine.ts`
  - **Depends on:** 10.6.1
  - **Acceptance:** Partners receive nudge DMs for overdue items, escalation levels work correctly

#### 10.7 L10 Meeting Prep

- [x] **10.7.1** Build agent-powered L10 prep generator
  - Create `src/lib/agents/l10-prep.ts`
  - `generateL10Prep(organizationId)` — comprehensive prep from all agent data
  - Detect L10 meetings 3 days ahead via `ingested_data` (source: `calendar`, data_type: `calendar_event`, relevance_tags containing `l10`)
  - Aggregate from all sources:
    - Rock status (all partners, % complete, days until due)
    - Scorecard trends (last 4 weeks, highlight consecutive misses)
    - Open Issues (prioritized by age and urgency)
    - Financial Strategist headline + key alerts
    - BD Strategist pipeline summary + deals at risk
    - To-do completion rate (last 2 weeks)
    - Action items from last L10 transcript (tracked via `relevance_tags @> '{l10}'`)
  - Generate structured prep via Claude Sonnet with Zod schema
  - **Files:** `ember/src/lib/agents/l10-prep.ts`
  - **Depends on:** 10.3.2, 10.4.3, 10.6.1
  - **Acceptance:** L10 prep document generated with multi-source data aggregation

- [x] **10.7.2** Wire L10 prep into morning briefing cron and deliver via Slack
  - Extend `morning-briefing/route.ts` to detect upcoming L10 (within 3 days)
  - When L10 detected, run `generateL10Prep()` and post to:
    - Slack channel (`#eos-pulse` or configured channel)
    - Individual partner DMs with personalized notes (their Rocks, their Todos, their Scorecard metrics)
  - Run once (not every morning) — track via `agent_outputs` to avoid duplicate prep
  - Store prep in `agent_outputs` (type: `briefing`, title: `L10 Prep - {date}`)
  - **Files:** `ember/src/app/api/agents/cron/morning-briefing/route.ts`, `ember/src/lib/agents/l10-prep.ts`
  - **Depends on:** 10.7.1
  - **Acceptance:** L10 prep posted to Slack 3 days before scheduled L10

**Phase 10 Checkpoint:**
- [ ] Grain transcripts auto-ingested via MCP Connector API (at least 1 meeting ingested without manual action)
- [ ] Grain AI notes mapped to Ember extractions, LLM extraction skipped when notes available
- [ ] BD Strategist generates pipeline health analysis overnight
- [ ] Partners receive pre-call intelligence briefs before external meetings
- [ ] Proactive nudges fire for overdue Rocks or Todos with correct escalation
- [ ] L10 prep document generated 3 days before scheduled L10
- [ ] Rich's morning briefing includes transcript highlights from previous day's meetings
- [ ] All queries use temporal filtering (source_timestamp) to prevent stale data

---

## Phase 12: Grain MCP Phase 2A — Sales Coaching Integration

**Plan:** `docs/plans/grain-mcp-phase2-improvements.md`
**Goal:** Ingest Grain's AI coaching feedback for sales/external calls and surface it in morning briefings and BD Strategist analysis.

#### 12.1 Coaching Data Ingestion

- [x] **12.1.1** Add coaching fetch to transcript ingestion cron
  - Extend `ingestFromGrainMcp()` in transcript ingestion cron
  - After ingesting transcript + notes, also call `fetchCoaching(meetingId)`
  - Store as separate `ingested_data` record: `source: 'grain', data_type: 'coaching_feedback'`
  - Payload: `{ meeting_title, meeting_id, coaching_markdown, score, categories, coaching_opportunities }`
  - Graceful skip if no coaching data available (not all meetings have it)
  - **Files:** `ember/src/app/api/agents/cron/ingest/transcripts/route.ts`
  - **Depends on:** 10.3.1
  - **Acceptance:** Coaching data appears in `ingested_data` after cron runs for meetings that have coaching

- [x] **12.1.2** Add `coaching_feedback` data type to agent types
  - Add `'coaching_feedback'` to `DataType` union in `src/types/agents.ts`
  - **Files:** `ember/src/types/agents.ts`
  - **Acceptance:** TypeScript accepts `coaching_feedback` as a valid data type

#### 12.2 Surface Coaching in Agents

- [x] **12.1.3** Surface coaching highlights in morning briefing
  - Add `getRecentCoaching(organizationId)` function to `ea-briefing.ts`
  - Query `ingested_data` where `source='grain'` and `data_type='coaching_feedback'` from last 48h
  - Add to `Promise.all` data assembly
  - Add `## Sales Coaching Highlights` section to briefing prompt
  - Include coaching opportunities in Tier 2 when available
  - **Files:** `ember/src/lib/agents/ea-briefing.ts`
  - **Depends on:** 12.1.1, 12.1.2
  - **Acceptance:** Morning briefing includes coaching highlights when coaching data exists

- [x] **12.1.4** Feed coaching data into BD Strategist analysis
  - Add `getRecentCoaching(organizationId)` function to `bd-strategist.ts`
  - Query recent coaching feedback (last 30 days) from `ingested_data`
  - Add `## Sales Coaching Data` section to BD Strategist prompt
  - Include coaching scores/opportunities in pipeline health assessment
  - **Files:** `ember/src/lib/agents/bd-strategist.ts`
  - **Depends on:** 12.1.1, 12.1.2
  - **Acceptance:** BD Strategist analysis references coaching data for recent sales calls

**Phase 12 Checkpoint:**
- [ ] Coaching data appears in `ingested_data` with `data_type: 'coaching_feedback'`
- [ ] Morning briefing includes coaching highlights when available
- [ ] BD Strategist analysis references coaching scores
- [ ] No errors when meetings lack coaching data (graceful skip)
- [ ] All quality checks pass: typecheck, lint, test, build

---

## Task Summary

| Phase | Section | Tasks | Focus |
|-------|---------|-------|-------|
| 8 (Week 1) | 8.1-8.21 | 32 | Agent foundation, connectors, briefing, Slack, Financial Strategist |
| 9 (Week 2) | 9.1-9.4 | 10 | Briefing excellence, HubSpot integration, settings page |
| 10 (Week 3) | 10.1-10.7 | 14 | Grain MCP ingestion, Grain notes parser, BD Strategist, pre-meeting prep, nudges, L10 prep |
| 11 (Slack Fixes) | 11.1-11.5 | 15 | mrkdwn escaping, section limits, date tokens, unfurl control, LLM sanitization |
| 12 (Grain 2A) | 12.1-12.2 | 4 | Sales coaching ingestion, briefing + BD Strategist integration |
| 13 (Pattern Detection) | 13.1-13.3 | 3 | Pattern detection engine, briefing + overnight integration |
| 15 (Marketing) | 15.1-15.3 | 3 | Marketing Strategist agent, overnight + briefing wiring |
| 16 (Innovation) | 16.1-16.3 | 3 | Product Innovation Officer agent, overnight + briefing wiring |
| 2A (Enrichment) | 2A.1-2A.3 | 3 | Cowork assessment enrichment of Financial, BD, Operations agents |
| **Total** | | **87** | |

---

## Task Log

| Date | Task ID | Description | Status |
|------|---------|-------------|--------|
| 2026-02-22 | 8.1.1 | Create agent system database migration | Complete |
| 2026-02-22 | 8.1.2 | Seed agent definitions and partner preferences | Complete |
| 2026-02-22 | 8.1.3 | Create directory structure and shared types | Complete |
| 2026-02-22 | 8.2.1 | Install googleapis and create Google OAuth2 client | Complete |
| 2026-02-22 | 8.2.2 | Build Gmail connector | Complete |
| 2026-02-22 | 8.3.1 | Build Calendar connector | Complete |
| 2026-02-22 | 8.4.1 | Create Google OAuth consent and callback routes | Complete |
| 2026-02-22 | 8.5.1 | Create data ingestion cron route | Complete |
| 2026-02-22 | 8.5.2 | Register data ingestion cron in vercel.json | Complete |
| 2026-02-22 | 8.6.1 | Create agent runtime core | Complete |
| 2026-02-22 | 8.6.2 | Create prompt manager | Complete |
| 2026-02-22 | 8.7.1 | Build EA briefing generator | Complete |
| 2026-02-22 | 8.8.1 | Install @slack/web-api and create Slack connector | Complete |
| 2026-02-22 | 8.8.2 | Build Slack Block Kit briefing formatter | Complete |
| 2026-02-22 | 8.8.3 | Build briefing delivery function | Complete |
| 2026-02-22 | 8.9.1 | Create morning briefing cron route | Complete |
| 2026-02-22 | 8.9.2 | Register morning briefing cron in vercel.json | Complete |
| 2026-02-22 | 8.10.1 | Create Slack events webhook route | Complete |
| 2026-02-23 | 8.10.2 | Deploy and configure Slack Events API | Complete |
| 2026-02-22 | 8.11.1 | Build natural language command parser | Complete |
| 2026-02-22 | 8.12.1 | Build command executor | Complete |
| 2026-02-22 | 8.13.1 | Implement emoji reaction approvals | Complete |
| 2026-02-23 | 8.14.1 | Install QuickBooks dependencies and create OAuth flow | Complete |
| 2026-02-23 | 8.14.2 | Build QuickBooks connector | Complete |
| 2026-02-23 | 8.15.1 | Build Financial Strategist agent | Complete |
| 2026-02-23 | 8.16.1 | Create overnight analysis cron route | Complete |
| 2026-02-23 | 8.16.2 | Register overnight analysis cron in vercel.json | Complete |
| 2026-02-23 | 8.17.1 | Update EA briefing with Financial Strategist outputs | Complete |
| 2026-02-22 | 8.18.1 | Create pipeline test endpoint | Complete |
| 2026-02-22 | 8.19.1 | Seed realistic EOS data for demo | Complete |
| 2026-02-22 | 8.20.1 | Add error handling and system alerts | Complete |
| 2026-02-22 | 8.21.1 | Prepare demo script — manual partner demo pending | Complete |
| 2026-02-23 | 9.1.1 | Enhance EA briefing data assembly | Complete |
| 2026-02-23 | 9.1.2 | Improve briefing prompt engineering | Complete |
| 2026-02-23 | 9.1.3 | Polish Slack Block Kit formatting | Complete |
| 2026-02-23 | 9.2.1 | Enrich Financial Strategist output | Complete |
| 2026-02-23 | 9.3.1 | Install HubSpot SDK and create OAuth flow | Complete |
| 2026-02-23 | 9.3.2 | Build HubSpot connector | Complete |
| 2026-02-23 | 9.3.3 | Add HubSpot to data ingestion cron | Complete |
| 2026-02-23 | 9.3.4 | Add pipeline data to EA briefing | Complete |
| 2026-02-23 | 9.4.1 | Build integrations settings page | Complete |
| 2026-02-23 | 9.4.2 | Build API route for connector status | Complete |
| 2026-02-25 | 10.1.1 | Obtain Grain MCP OAuth token via mcp-remote | Complete |
| 2026-02-25 | 10.1.2 | Build Grain MCP client wrapper | Complete |
| 2026-02-25 | 10.2.1 | Build Grain notes parser | Complete |
| 2026-02-25 | 10.2.2 | Short-circuit processing for Grain notes | Complete |
| 2026-02-25 | 10.3.1 | Rewrite transcript cron with Grain MCP | Complete |
| 2026-02-25 | 10.3.2 | Transcript highlights in briefing (already implemented) | Complete |
| 2026-02-25 | 10.4.1 | Seed BD Strategist agent definition + partner preferences (already implemented) | Complete |
| 2026-02-25 | 10.4.2 | Build BD Strategist analysis module (already implemented) | Complete |
| 2026-02-25 | 10.4.3 | Add BD Strategist to overnight cron + briefing (already implemented) | Complete |
| 2026-02-25 | 10.5.1 | Build pre-meeting intelligence generator (already implemented) | Complete |
| 2026-02-25 | 10.5.2 | Wire pre-meeting prep into morning briefing cron (already implemented) | Complete |
| 2026-02-26 | 12.1.1 | Add coaching fetch to transcript ingestion cron | Complete |
| 2026-02-26 | 12.1.2 | Add coaching_feedback data type to agent types | Complete |
| 2026-02-26 | 12.1.3 | Surface coaching highlights in morning briefing | Complete |
| 2026-02-26 | 12.1.4 | Feed coaching data into BD Strategist analysis | Complete |
| 2026-02-27 | 13.1.1 | Create pattern detection engine with 6 detection rules | Complete |
| 2026-02-27 | 13.2.1 | Wire pattern detection into morning briefing | Complete |
| 2026-02-27 | 13.3.1 | Wire pattern detection into overnight analysis | Complete |
| 2026-02-27 | 15.1.1 | Create Marketing Strategist agent | Complete |
| 2026-02-27 | 15.2.1 | Seed Marketing Strategist + wire into overnight + briefing | Complete |
| 2026-02-27 | 15.3.1 | Quality check Marketing Strategist | Complete |
| 2026-02-27 | 16.1.1 | Create Product Innovation Officer agent | Complete |
| 2026-02-27 | 16.2.1 | Seed Product Innovation Officer + wire into overnight + briefing | Complete |
| 2026-02-27 | 16.3.1 | Quality check Product Innovation Officer | Complete |
| 2026-02-28 | 2A.1 | Enrich Financial Strategist with Cowork assessment | Complete |
| 2026-02-28 | 2A.2 | Enrich BD Strategist with Cowork assessment | Complete |
| 2026-02-28 | 2A.3 | Enrich Operations Architect with Cowork assessment | Complete |

---

## Phase 2: Intelligence Layer

### Phase 13: Pattern Detection Engine
> "Surface what's not being said" — the core differentiator

- [x] 13.1.1 Create pattern detection engine with 6 detection rules
  - **Files:** `src/lib/agents/pattern-detector.ts` (NEW)
  - Pure data queries (no LLM): stalled rocks, scorecard misses without issues, topic avoidance, untracked commitments, concentration worsening, partner workload imbalance
  - Output: `PatternAlert[]` with severity levels (observation/concern/escalation)

- [x] 13.2.1 Wire pattern detection into morning briefing
  - **Files:** `src/lib/agents/ea-briefing.ts` (MODIFY)
  - Add `runPatternDetection(orgId)` to Promise.all data assembly
  - Add `## Pattern Observations` section to briefing prompt
  - Concerns → Tier 1, Observations → Tier 2, Escalations → auto-create Issues

- [x] 13.3.1 Wire pattern detection into overnight analysis
  - **Files:** `src/app/api/agents/cron/overnight-analysis/route.ts` (MODIFY)
  - Run pattern detection as part of nightly cron
  - Weekly deep scan on Sundays for cross-agent pattern analysis

**Checkpoint:** Pattern alerts appear in daily briefing. Stalled rock + scorecard miss patterns detected correctly. Escalation auto-creates Issue with duplicate check.

### Phase 15: Marketing Strategist Agent
> Fractional CMO — competitive intel, positioning, content strategy, client language mining
> Strategic foundation: `docs/Caldera_Marketing_Strategy_Assessment.md`

- [x] 15.1.1 Create Marketing Strategist agent
  - **Files:** `src/lib/agents/marketing-strategist.ts` (NEW)
  - Follows `bd-strategist.ts` pattern: Zod schema → data fetch → prompt → generateObject → save → auto-Issue
  - Schema: positioning_score, competitive_landscape[], content_opportunities[], client_language_insights[], market_signals[]
  - Data: Grain transcripts (language mining), Brave Search (competitor news), HubSpot (deal narratives), existing Issues

- [x] 15.2.1 Seed Marketing Strategist + wire into overnight analysis + briefing
  - **Files:** `supabase/migrations/018_seed_marketing_strategist.sql` (NEW), `overnight-analysis/route.ts` (MODIFY), `ea-briefing.ts` (MODIFY), `slack-briefing.ts` (MODIFY)
  - Add `runMarketingAnalysis(orgId)` to overnight cron
  - Add `getMarketingInsights(orgId)` + `## Marketing & Positioning` section to briefing
  - Add `'marketing-strategist': ':mega:'` to AGENT_EMOJI

- [x] 15.3.1 Quality check Marketing Strategist
  - Trigger overnight cron → verify analysis in `agent_outputs`
  - Trigger briefing → verify marketing insights appear
  - Quality gate: `npm run typecheck && npm run lint && npm run test && npm run build`

**Checkpoint:** Marketing analysis appears in overnight cron output. Briefing includes positioning score, competitive landscape, and content opportunities. Auto-Issues created for positioning gaps.

### Phase 16: Product Innovation Officer Agent
> Continuous market radar and idea processor — surfaces trends and signals for leadership consideration
> Strategic foundation: `docs/Caldera_Product_Innovation_Assessment.md`

- [x] 16.1.1 Create Product Innovation Officer agent
  - **Files:** `src/lib/agents/product-innovation.ts` (NEW)
  - Follows `bd-strategist.ts` pattern: Zod schema → data fetch → prompt → generateObject → save → auto-Issue
  - Schema: technology_trends[], market_signals[], competitor_product_moves[], opportunity_seeds[], bench_time_signals
  - Data: Brave Search (tech trends, competitor products), Grain transcripts (client patterns), Financial Strategist (utilization), existing Issues

- [x] 16.2.1 Seed Product Innovation Officer + wire into overnight analysis + briefing
  - **Files:** `supabase/migrations/019_seed_product_innovation.sql` (NEW), `overnight-analysis/route.ts` (MODIFY), `ea-briefing.ts` (MODIFY), `slack-briefing.ts` (MODIFY)
  - Add `runInnovationAnalysis(orgId)` to overnight cron
  - Add `getInnovationInsights(orgId)` + `## Product & Innovation` section to briefing
  - Add `'product-innovation': ':rocket:'` to AGENT_EMOJI

- [x] 16.3.1 Quality check Product Innovation Officer
  - Trigger overnight cron → verify analysis in `agent_outputs`
  - Trigger briefing → verify innovation insights appear
  - Quality gate: `npm run typecheck && npm run lint && npm run test && npm run build`

**Checkpoint:** Innovation analysis appears in overnight cron output. Briefing includes tech trends, market signals, and opportunity seeds. Agent philosophy: radar, not prescriber.

### Phase 2A: Cowork Strategic Assessment Enrichment

> Enrich existing agent personas with deep strategic intelligence from Cowork plugin assessments

- [x] 2A.1 Enrich Financial Strategist with Cowork Financial Strategy Assessment
  - **Files:** `src/lib/agents/financial-strategist.ts` (MODIFY)
  - Added: health_score (composite 0-100), revenue_forecast (30/60/90d), scope_creep_signals, portfolio_classification, cash runway tiers, HHI concentration index, pricing intelligence, pipeline data fetching
  - Strategic foundation: `docs/Caldera_Financial_Strategy_Assessment.md`

- [x] 2A.2 Enrich BD Strategist with Cowork Sales & BD Strategy Assessment
  - **Files:** `src/lib/agents/bd-strategist.ts` (MODIFY)
  - Added: FIRE qualification framework (per-deal scoring), pipeline_velocity, diversification_tracker, competitive_signals, pricing_signals, coaching_themes, close-or-kill enforcement at 90 days
  - Strategic foundation: `docs/Caldera_Sales_BD_Strategy_Assessment.md`

- [x] 2A.3 Enrich Operations Architect with Cowork Operations Strategy Assessment
  - **Files:** `src/lib/agents/operations-architect.ts` (MODIFY)
  - Added: ops_maturity_score, engagement_scores with health predictions, Client Health Score model (churn/expansion), scope creep detection (5 signal types), SOW quality scoring, handoff quality scoring, capacity_forecast, process maturity model, auto-issue for churn-imminent clients
  - Strategic foundation: `docs/Caldera_Operations_Strategy_Assessment.md`

**Checkpoint:** All 3 existing agents enriched with Cowork strategic assessments. Expanded thresholds, schemas, system prompts, and detection logic. Quality gate passed.

---

## Phase 11: Slack Formatting Fixes

**Plan:** `docs/plans/slack-formatting-fixes.md`
**Goal:** Harden all Slack message formatting — mrkdwn escaping, Block Kit structural limits, and platform feature adoption. No new features; strictly audit-driven fixes.

### 11.1 Formatting Utilities

- [x] **11.1.1** Create `lib/slack-format.ts` with formatting utilities
  - `escapeSlackMrkdwn(text)` — escape `&`, `<`, `>` for safe mrkdwn interpolation
  - `slackDate(date, format, fallback)` — generate `<!date^unix^{tokens}|fallback>` strings
  - `truncateForSlack(text, maxLen)` — truncate at word boundary, append `…` if truncated (default 2800 chars to stay under 3000 section limit)
  - `sanitizeLLMForMrkdwn(text)` — convert common standard Markdown to mrkdwn (`**bold**` → `*bold*`, `[text](url)` → `<url|text>`, `## heading` → `*heading*`)
  - Add unit tests in `__tests__/lib/slack-format.test.ts`
  - **Files:** `ember/src/lib/slack-format.ts` (NEW), `ember/src/__tests__/lib/slack-format.test.ts` (NEW)
  - **Acceptance:** All 4 utility functions exported, tests pass for edge cases (`&amp;` double-escaping, truncation at word boundary, date token generation, LLM markdown conversion)

### 11.2 Phase 1 — Safety & Correctness (High Priority)

- [x] **11.2.1** Add mrkdwn escaping to `slack-briefing.ts`
  - Import `escapeSlackMrkdwn` from `lib/slack-format`
  - Escape all user-generated content: `item.title`, `item.detail`, `item.source` (in news links), `item.summary`, `item.agent_name`
  - Do NOT escape mrkdwn syntax we build ourselves (e.g., `*bold*`, `<url|text>`)
  - **Files:** `ember/src/lib/agents/slack-briefing.ts`
  - **Depends on:** 11.1.1
  - **Acceptance:** Rock title with `>` or `&` characters renders correctly in Slack briefing

- [x] **11.2.2** Add mrkdwn escaping to `morning-briefing/route.ts`
  - Escape: `brief.meetingTitle`, `brief.attendees` (join), `prep.headline`, `prep.scorecard_review.summary`, `prep.rock_review.summary`, `prep.todo_review.note`, `prep.financial_snapshot`, `prep.pipeline_snapshot`, issue titles, rock titles/notes, todo carry-forward items
  - **Files:** `ember/src/app/api/agents/cron/morning-briefing/route.ts`
  - **Depends on:** 11.1.1
  - **Acceptance:** L10 prep and pre-call brief render safely with special characters in EOS data

- [x] **11.2.3** Add mrkdwn escaping to `nudge-engine.ts`
  - Escape: `nudge.itemTitle`, `nudge.message`, `nudge.targetPartnerName`
  - **Files:** `ember/src/lib/agents/nudge-engine.ts`
  - **Depends on:** 11.1.1
  - **Acceptance:** Nudge for a todo titled `Fix login & signup` renders `&amp;` correctly

- [x] **11.2.4** Add mrkdwn escaping to `scorecard-automation/route.ts` and `command-executor.ts`
  - Scorecard: escape `metricName` in metric list and reply instructions
  - Command executor: escape `output.title` in approve/reject/defer confirmations
  - **Files:** `ember/src/app/api/agents/cron/scorecard-automation/route.ts`, `ember/src/lib/agents/command-executor.ts`
  - **Depends on:** 11.1.1
  - **Acceptance:** Metric named `Revenue > Target` renders safely in scorecard prompt

- [x] **11.2.5** Add section text chunking to `slack-briefing.ts`
  - Tier 2 business items: if joined text > 2800 chars, split into multiple section blocks (one per item)
  - FYI items: same chunking logic
  - Industry Pulse: same chunking logic
  - Work queue items: same chunking logic
  - Use `truncateForSlack()` for individual items that are themselves very long
  - **Files:** `ember/src/lib/agents/slack-briefing.ts`
  - **Depends on:** 11.1.1
  - **Acceptance:** Briefing with 10+ business updates renders all items without truncation

- [x] **11.2.6** Add section text truncation to `morning-briefing/route.ts`
  - Pre-call `brief.brief` (LLM output): truncate to 2800 chars with `truncateForSlack()`
  - IDS priority list: chunk into multiple sections if > 2800 chars
  - Ember observations: chunk into multiple sections if > 2800 chars
  - **Files:** `ember/src/app/api/agents/cron/morning-briefing/route.ts`
  - **Depends on:** 11.1.1
  - **Acceptance:** Pre-call brief with long LLM output truncates gracefully with `…`

### 11.3 Phase 2 — Platform Features (Medium Priority)

- [x] **11.3.1** Replace static dates with `<!date^>` tokens
  - `slack-briefing.ts` line 71: briefing header date → `<!date^{unix}^{date_long}|{fallback}>`
  - `slack-connector.ts` line 123: system alert timestamp → `<!date^{unix}^{date_short} {time}|{iso}>`
  - `morning-briefing/route.ts` line 337: pre-call meeting time → `<!date^{unix}^{time}|{time}>`
  - `nudge-engine.ts` line 502: "Last Updated" field → `<!date^{unix}^{date_short}|{date}>`
  - **Files:** `ember/src/lib/agents/slack-briefing.ts`, `ember/src/lib/connectors/slack-connector.ts`, `ember/src/app/api/agents/cron/morning-briefing/route.ts`, `ember/src/lib/agents/nudge-engine.ts`
  - **Depends on:** 11.1.1
  - **Acceptance:** Dates render in reader's local timezone in Slack. Fallback text displays correctly for clients that don't support `<!date^>`.

- [x] **11.3.2** Suppress link unfurling on briefing and scorecard messages
  - Add optional `unfurl_links` and `unfurl_media` params to `postBlockMessage()` in `slack-connector.ts`
  - Pass `unfurl_links: false, unfurl_media: false` from `deliverBriefing()` in `slack-briefing.ts`
  - Pass same from `promptForManualMetrics()` in `scorecard-automation/route.ts`
  - **Files:** `ember/src/lib/connectors/slack-connector.ts`, `ember/src/lib/agents/slack-briefing.ts`, `ember/src/app/api/agents/cron/scorecard-automation/route.ts`
  - **Acceptance:** Briefing with Industry Pulse news links does not show link preview cards

- [x] **11.3.3** Improve morning briefing fallback text
  - Replace `"Morning Briefing — ${briefing.briefing_date}"` with summary: `"Morning Briefing — Mar 1 | 2 urgent, 3 updates, 4 items for review"`
  - Build fallback from `tier1.length`, `tier2.length`, `tier3.length`, `workQueue.length`
  - **Files:** `ember/src/lib/agents/slack-briefing.ts`
  - **Acceptance:** Push notification shows item counts alongside the date

### 11.4 Phase 3 — Structural Improvements (Low Priority)

- [x] **11.4.1** Add `action_id` to checkup reminder button
  - Add `action_id: 'checkup_take_assessment'` to the button in `buildCheckupReminderBlocks()`
  - **Files:** `ember/src/lib/slack.ts`
  - **Acceptance:** Button element has `action_id` property

- [x] **11.4.2** Convert L10 prep to use section `fields` layout
  - Combine Scorecard + Rocks into one section with `fields` (2-column)
  - Combine Financial + Pipeline into one section with `fields` (2-column)
  - Keep To-Dos as standalone section (multi-line content doesn't fit fields well)
  - **Files:** `ember/src/app/api/agents/cron/morning-briefing/route.ts`
  - **Acceptance:** L10 prep renders in compact 2-column layout for key-value data

- [x] **11.4.3** Sanitize LLM output in command executor
  - Apply `sanitizeLLMForMrkdwn()` to EA query responses before posting to Slack
  - **Files:** `ember/src/lib/agents/command-executor.ts`
  - **Depends on:** 11.1.1
  - **Acceptance:** EA response using `**bold**` converts to `*bold*` before posting

- [x] **11.4.4** Add mrkdwn escaping to `slack.ts` checkup reminders
  - Escape `periodName` in `buildCheckupReminderBlocks()`
  - **Files:** `ember/src/lib/slack.ts`
  - **Depends on:** 11.1.1
  - **Acceptance:** Period name with special characters renders safely

### 11.5 Quality Gate

- [x] **11.5.1** Run quality gate and verify in production
  - Run: `npm run typecheck && npm run lint && npm run test && npm run build`
  - Trigger briefing pipeline via test endpoint: `/api/agents/test/pipeline?step=all`
  - Verify Slack rendering: dates localized, no broken links, sections not truncated
  - **Acceptance:** All quality checks pass, briefing renders correctly in Slack

**Phase 11 Checkpoint:**
- [x] All user-generated content escaped before mrkdwn interpolation
- [x] No section text exceeds 3,000 char limit
- [x] Dates render in reader's local timezone via `<!date^>` tokens
- [x] Link unfurling suppressed on briefing messages
- [x] Push notification fallback text includes item counts
- [x] LLM output sanitized for mrkdwn before posting
- [x] All quality checks pass: typecheck, lint, test, build

---

## Notes

- Tasks should be completed in order within each phase
- Each phase has a checkpoint that must be verified before proceeding
- Pattern Detection Engine (Phase 13) is pure data queries — no LLM needed
- Marketing Strategist and Product Innovation Officer follow the bd-strategist.ts agent pattern
- Strategic foundation docs inform system prompts but are not re-analyzed by agents
- All agents must degrade gracefully when data is unavailable
- Update this file as tasks are completed
- Add blockers and notes in the Task Log
