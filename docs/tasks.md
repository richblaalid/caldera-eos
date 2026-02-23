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

- [ ] **9.4.1** Build integrations settings page
  - Create `/dashboard/settings/integrations/page.tsx`
  - Show connector status cards: Google (Gmail + Calendar), Slack, HubSpot, QuickBooks
  - Each card shows: connected/disconnected, last sync time, connect/disconnect button
  - Connect buttons link to respective OAuth flows
  - **Files:** `ember/src/app/dashboard/settings/integrations/page.tsx`, `ember/src/components/dashboard/IntegrationCard.tsx`
  - **Depends on:** 9.3.1
  - **Acceptance:** Page renders connector status, OAuth flows launchable from UI

- [ ] **9.4.2** Build API route for connector status
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

## Task Summary

| Day | Section | Tasks | Focus |
|-----|---------|-------|-------|
| Day 1 | 8.1-8.5 | 9 | DB, types, Gmail/Calendar connectors, Google OAuth, ingestion cron |
| Day 2 | 8.6-8.9 | 8 | Agent runtime, EA briefing, Slack delivery, morning cron |
| Day 3 | 8.10-8.13 | 5 | Slack events, command parser, executor, reactions |
| Day 4 | 8.14-8.17 | 6 | QuickBooks, Financial Strategist, overnight pipeline, EA integration |
| Day 5 | 8.18-8.21 | 4 | E2E testing, data quality, polish, demo |
| **Total** | | **32** | |

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

---

## Notes

- Tasks should be completed in order within each day
- Each day has a checkpoint that must be verified before proceeding
- Slack Events API requires deployed endpoint before Slack config (see Day 3 note)
- QuickBooks connector has mock data contingency if API unavailable
- Update this file as tasks are completed
- Add blockers and notes in the Task Log
