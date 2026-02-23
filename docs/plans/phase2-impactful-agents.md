# Phase 2 Implementation Plan: Making the Agent Pipeline Impactful

**Date:** February 23, 2026
**Scope:** PRD v2.0 Sections 7, 8, 12 — Weeks 2-4 (Core Agent Activation)
**Goal:** Transform the working pipeline from a technical proof-of-concept into a system Rich relies on every morning. Make the briefing genuinely useful, get real data flowing, and activate the first advisory agent that directly supports Caldera's business.

---

## Current State (Week 1 Complete)

### What's Working
- **Pipeline:** Data ingestion (15min) → Overnight analysis → Morning briefing → Slack delivery ✅
- **Connectors:** Gmail, Calendar, QuickBooks (all connected, pulling real data) ✅
- **EA Agent:** Three-tier briefing generation with structured output ✅
- **Financial Strategist:** Margin analysis, AR alerts, threshold-based Issue creation ✅
- **Slack Interaction:** Command parsing (approve/reject/defer), emoji reactions, threaded replies ✅
- **Database:** Full agent schema with RLS, partner preferences, audit logging ✅

### What's Not Yet Impactful
- **Briefing quality** — Generic summaries, not enough context to act on. Needs richer data and smarter synthesis.
- **No HubSpot data** — Sales pipeline is invisible to Ember. John gets no value.
- **No real financial data** — QuickBooks is connected but data needs validation and enrichment.
- **No meeting intelligence** — Grain transcripts aren't flowing into the pipeline.
- **No L10 prep** — The EOS ceremony cadence isn't wired into the agent system.
- **No proactive nudges** — Overdue items are listed but there's no escalation or follow-up.
- **Briefing formatting** — Block Kit messages need refinement for scannability and action.
- **No settings page** — Connector status, agent config, and preferences have no UI.

---

## Strategic Priorities (Weeks 2-4)

The PRD Phase 1 roadmap says "Core Agent Activation" but the real goal is making Ember indispensable. This plan prioritizes by **impact to Rich's daily workflow** rather than feature completeness:

### Priority 1: Make the Morning Briefing Excellent (Week 2)
The briefing is the flagship product. If Rich opens Slack at 7 AM and thinks "this is useful," everything else follows. If not, nothing else matters.

### Priority 2: Get Real Data Flowing (Weeks 2-3)
HubSpot gives Rich pipeline visibility. Grain transcripts give Ember meeting context. Real QuickBooks data (validated) gives the Financial Strategist teeth.

### Priority 3: Activate BD Strategist for John (Week 3)
John is the hardest user to engage. Pre-call intelligence and pipeline analysis pushed to Slack — zero-friction value.

### Priority 4: EOS Ceremony Automation (Week 4)
L10 prep, Rock reminders, and proactive nudges. This is where Ember becomes the "fourth partner" — not just informing, but driving the EOS rhythm.

---

## Technical Approach

### What We're Building

**Week 2 — Briefing Excellence + HubSpot Foundation:**
- Improve briefing content quality (richer prompts, better data assembly, formatting polish)
- Build HubSpot connector (deals, contacts, companies, pipeline stages)
- HubSpot OAuth flow
- Add pipeline data to EA briefing
- Build settings/integrations page for connector management

**Week 3 — Real Data + BD Strategist:**
- Grain transcript auto-ingestion (via Grain MCP or API)
- BD Strategist agent (pipeline health, pre-call briefs, prospect research)
- John's EA variant (push-heavy, sales-focused briefing)
- Proactive nudge system (overdue Rocks, stalled Todos)

**Week 4 — EOS Ceremony Support + Polish:**
- L10 meeting prep automation (3 days before → auto-generate prep document)
- Rock milestone tracking with escalation
- Scorecard auto-population from connectors
- Agent activity dashboard in Ember UI
- Settings page for partner preferences and agent tuning

### What We're NOT Building in Weeks 2-4
- Marketing Strategist, Operations Architect, Product Innovation Officer (Phase 2, Weeks 5-8)
- Vector embeddings and semantic search on ingested data (Phase 2)
- Agent-to-agent communication (Phase 3)
- Client health scoring (Phase 3)
- Wade's EA variant (Week 5 — Wade is the most engaged with the platform directly, so his EA is lower urgency)

### Key Architecture Decisions

**HubSpot Integration Approach:**
Use HubSpot's REST API v3 with OAuth2. Pull deals, contacts, companies, engagements. The hubspot-api-client npm package provides typed SDK. Polling frequency: every 30 minutes for deals, daily for contacts/companies.

**Grain Integration Approach:**
We have the Grain MCP server connected already. Use it for on-demand transcript retrieval. For automated ingestion, use the Grain webhook or poll `list_meetings` for new recordings since last sync. Store transcripts in existing `transcripts` table AND normalized summaries in `ingested_data`.

**BD Strategist Pattern:**
Follows the Financial Strategist pattern exactly — agent definition in DB, dedicated analysis module in `src/lib/agents/`, invoked by overnight cron, outputs feed into EA briefing. Add a pre-meeting briefing trigger that runs 2 hours before any external sales meeting.

**L10 Prep Pattern:**
Cron-triggered 3 days before scheduled L10 (detect via Calendar connector). Aggregates: overdue Rocks, missed Scorecard targets, open Issues, Financial Strategist insights, BD pipeline summary. Generates a structured prep document and posts to Slack.

---

## Day-by-Day Plan

### Week 2, Days 1-2: Briefing Excellence

**Goal:** The morning briefing goes from "interesting demo" to "genuinely useful daily tool."

**What changes:**
- Richer prompt engineering — briefing prompt gets Caldera-specific context, partner role awareness, and actionable language
- Better data assembly — pull 7 days of calendar (not just today), recent Scorecard trends (not just current values), Rock milestone progress
- Formatting improvements — more concise Block Kit messages, clear action items, deep links to Ember
- Financial Strategist output integration — include specific dollar amounts, client names, trend direction

**Files:** `ea-briefing.ts`, `prompt-manager.ts`, `slack-briefing.ts`

### Week 2, Days 3-5: HubSpot Integration

**Goal:** Sales pipeline data flows into Ember. Briefing includes pipeline status.

**What changes:**
- HubSpot OAuth flow (`/api/agents/auth/hubspot/` route + callback)
- HubSpot connector (`src/lib/connectors/hubspot-connector.ts`) — pulls deals, contacts, pipeline stages
- Data ingestion cron extended to include HubSpot (30-minute polling)
- EA briefing updated to include pipeline summary
- Settings/integrations page built (`/dashboard/settings/integrations`)

**Files:** New: `hubspot-connector.ts`, auth routes, settings page. Modified: `data-ingestion/route.ts`, `ea-briefing.ts`

### Week 3, Days 1-2: Grain Transcript Ingestion

**Goal:** Meeting transcripts flow into the pipeline. Agents can reference what was discussed.

**What changes:**
- Grain connector that polls for new meetings (or leverages existing `/sync-grain` command infrastructure)
- Transcript summaries stored in `ingested_data` for agent consumption
- Full transcripts stored in existing `transcripts` table for deep retrieval
- EA briefing references relevant transcript highlights (yesterday's meetings → key takeaways)

**Files:** New: `grain-connector.ts`. Modified: `data-ingestion/route.ts`, `ea-briefing.ts`

### Week 3, Days 3-5: BD Strategist + John's EA

**Goal:** John gets pre-call intelligence pushed to Slack. Pipeline health appears in all briefings.

**What changes:**
- BD Strategist agent definition seeded in DB
- BD Strategist analysis module (`src/lib/agents/bd-strategist.ts`)
  - Pipeline health: deal velocity, stage distribution, aging deals
  - Pre-call briefs: before external sales meetings, compile prospect context from HubSpot + emails + transcripts
  - Win/loss patterns: what's working, what's not
- John's EA variant — briefing weighted toward sales, pipeline, and client interactions
- Pre-meeting trigger: 2 hours before external meetings, push prep to partner DM
- Overnight analysis cron extended to run BD Strategist

**Files:** New: `bd-strategist.ts`, update cron routes. Modified: `ea-briefing.ts`, `overnight-analysis/route.ts`

### Week 4, Days 1-2: Proactive Nudge System

**Goal:** Ember doesn't just inform — it pushes accountability.

**What changes:**
- Nudge engine (`src/lib/agents/nudge-engine.ts`)
  - Detects: overdue Todos (>7 days), stalled Rocks (no milestone progress in 2+ weeks), missed Scorecard targets (3+ consecutive weeks)
  - Three escalation levels per ADR-009:
    1. Gentle reminder (Slack DM)
    2. Direct nudge with data ("This is week 3 without progress")
    3. L10 escalation (creates Issue for group discussion)
  - Tracks nudge history to avoid spam
- Nudge check added to morning briefing cron (runs before briefing generation)

**Files:** New: `nudge-engine.ts`. Modified: `morning-briefing/route.ts`

### Week 4, Days 3-4: L10 Meeting Prep Automation

**Goal:** Three days before each L10, Ember generates a comprehensive prep document.

**What changes:**
- L10 prep generator (`src/lib/agents/l10-prep.ts`)
  - Detects upcoming L10 via Calendar connector
  - Aggregates: Rock status (all partners), Scorecard misses, open Issues (prioritized), Financial highlights, Pipeline summary, To-do completion rate
  - Generates structured prep document
  - Posts to `#eos-pulse` Slack channel + individual partner DMs with personalized notes
- L10 prep cron entry OR triggered by morning briefing when L10 detected within 3 days

**Files:** New: `l10-prep.ts`. Modified: `vercel.json` (if separate cron), `morning-briefing/route.ts`

### Week 4, Day 5: Settings UI + Agent Dashboard

**Goal:** Rich can see connector status, agent activity, and configure preferences.

**What changes:**
- Settings/integrations page (`/dashboard/settings/integrations`)
  - Google: connected/disconnected status, re-auth button
  - Slack: connected status, channel selection
  - HubSpot: connected/disconnected, sync status
  - QuickBooks: connected/disconnected, last sync time
  - Grain: sync controls
- Agent activity page (`/dashboard/agents`)
  - Recent agent runs with status/timing
  - Agent outputs with approve/reject UI
  - Briefing history

**Files:** New: settings and agent dashboard pages + components

---

## New Dependencies

```bash
# HubSpot
npm install @hubspot/api-client

# No new deps needed for Grain (using existing MCP)
# No new deps needed for nudge system or L10 prep
```

---

## New Files Created (Estimated)

```
ember/src/
├── lib/
│   ├── agents/
│   │   ├── bd-strategist.ts        # BD Strategist analysis
│   │   ├── nudge-engine.ts         # Proactive nudge system
│   │   └── l10-prep.ts             # L10 meeting prep generator
│   └── connectors/
│       ├── hubspot-connector.ts    # HubSpot API connector
│       └── grain-connector.ts      # Grain transcript connector
├── app/
│   ├── api/agents/auth/
│   │   ├── hubspot/route.ts        # HubSpot OAuth initiation
│   │   └── hubspot/callback/route.ts
│   └── dashboard/
│       ├── settings/
│       │   └── integrations/page.tsx  # Connector management
│       └── agents/page.tsx            # Agent activity dashboard
└── components/
    └── dashboard/
        ├── IntegrationCard.tsx     # Connector status card
        └── AgentActivityTable.tsx  # Agent run history
```

---

## Existing Files Modified

| File | Change |
|------|--------|
| `ea-briefing.ts` | Richer data assembly, HubSpot/Grain data, formatting improvements |
| `prompt-manager.ts` | Enhanced prompts with Caldera-specific context |
| `slack-briefing.ts` | Block Kit formatting improvements |
| `data-ingestion/route.ts` | Add HubSpot and Grain connector orchestration |
| `overnight-analysis/route.ts` | Add BD Strategist invocation |
| `morning-briefing/route.ts` | Add nudge check, L10 prep detection |
| `vercel.json` | Potential new cron entries |
| Agent seed migration | BD Strategist agent definition |

---

## Success Criteria

### Week 2
- [ ] Rich rates morning briefing 7+/10 for usefulness
- [ ] HubSpot connector pulls real deal/pipeline data
- [ ] Pipeline summary appears in morning briefing
- [ ] Settings page shows connector status

### Week 3
- [ ] Grain transcripts flow into pipeline
- [ ] BD Strategist generates pipeline health analysis
- [ ] John receives pre-call intelligence for at least 1 meeting
- [ ] John's briefing is sales-weighted (different from Rich's)

### Week 4
- [ ] Proactive nudges fire for overdue items
- [ ] L10 prep document generated before weekly meeting
- [ ] Agent activity visible in Ember UI
- [ ] Rich can manage connector settings without developer intervention

### Overall Phase 2 Success
- [ ] Rich saves 3+ hours/week on operational prep
- [ ] At least 1 agent-generated Issue discussed in L10
- [ ] John consumes at least 2 pre-call briefs per week
- [ ] Morning briefing delivery 99% reliability (weekdays)

---

## Risk Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| HubSpot API requires paid plan | MEDIUM | Check Caldera's HubSpot tier; if free, use web scraping or defer |
| Briefing quality still low after improvements | MEDIUM | Iterative tuning with Rich's daily feedback; use Claude Opus for critical synthesis if Sonnet insufficient |
| John doesn't engage with briefings | HIGH | Make John's briefing 100% push (no action required); prove value with pre-call prep accuracy |
| L10 detection from calendar unreliable | LOW | Add manual L10 schedule in partner_preferences as fallback |
| Grain API rate limits | LOW | Cache transcripts, batch processing, respect rate limits |
| Too many nudges (alert fatigue) | MEDIUM | Conservative thresholds, max 1 nudge per item per day, weekly digest option |

---

## Phase 2 Checkpoint (End of Week 4)

Before proceeding to Phase 3 (Weeks 5-8: Intelligence Layer), verify:
- [ ] 4+ data sources actively flowing (Gmail, Calendar, HubSpot, QuickBooks, Grain)
- [ ] 3 agents running (EA, Financial Strategist, BD Strategist)
- [ ] Morning briefing rated 7+/10 by Rich for 2+ consecutive weeks
- [ ] John has received and acted on at least 1 pre-call brief
- [ ] L10 prep generated for at least 2 meetings
- [ ] Agent outputs have been approved/rejected via Slack (workflow loop proven)
- [ ] System runs autonomously for 5 consecutive weekdays without intervention
