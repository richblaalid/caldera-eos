# ADR-008: Extend Ember Platform vs. Build New System

**Status:** Accepted
**Date:** February 22, 2026
**Decision Makers:** Rich (CEO/Integrator)
**Context:** Whether the agent system should be built as an extension of the existing Ember application or as a separate system

---

## Context

Ember is a deployed Next.js 14 application with Supabase backend, Claude AI integration, Slack posting, and a complete EOS data model. The agent system requires persistent scheduling, multi-source data ingestion, proactive notifications, and a richer Slack integration. We need to decide whether to extend Ember or build a parallel system.

### Current Ember Assets Worth Preserving

| Asset | Maturity | Effort to Rebuild |
|-------|----------|-------------------|
| EOS database schema (V/TO, Rocks, Scorecard, Issues, To-dos, Meetings) | Production | HIGH — 34 API routes |
| Supabase Auth + Google OAuth + RLS | Production | MEDIUM |
| AI Chat with 9 tool-calling capabilities | Production | HIGH |
| Hybrid RAG (EOS methodology + transcripts) | Production | HIGH |
| Transcript processing pipeline | Production | MEDIUM |
| Meeting prep cron job | Working | LOW |
| Slack OAuth + channel posting | Working | LOW |
| Organizational Checkup with scoring | Production | MEDIUM |
| Dashboard UI (~25 pages) | Production | HIGH |
| Multi-tenant with RLS | Production | HIGH |

### What the Agent System Needs That Ember Doesn't Have

| Need | Gap |
|------|-----|
| Slack bidirectional (read + command processing) | Currently write-only |
| Scheduled multi-agent orchestration | Only simple cron jobs exist |
| External API connectors (Gmail, Calendar, HubSpot, QuickBooks, Gusto) | None exist |
| Agent-specific prompt management | Chat has one system prompt |
| Approval workflow | Not implemented |
| Agent output storage and tracking | Not implemented |
| Personal vs. shared data scoping | Only org-level scoping exists |

## Decision

**Extend Ember.** The agent system is built as a new layer within the existing Ember application, not as a separate system.

### Architecture Within Ember

```
EXISTING EMBER (preserved as-is):
├── /app/                  ← Existing Next.js pages and UI
├── /app/api/              ← Existing 34+ API routes for EOS data
├── /lib/ai/               ← Existing chat, RAG, transcript processing
├── /lib/slack/            ← Existing Slack posting
└── Supabase schema        ← Existing EOS tables with RLS

NEW AGENT LAYER (added alongside):
├── /app/api/agents/       ← Agent orchestration API routes
│   ├── orchestrator.ts    ← Central dispatcher for scheduled/event/request invocations
│   ├── ea/                ← Executive Assistant endpoints
│   ├── financial/         ← Financial Strategist endpoints
│   ├── marketing/         ← Marketing Strategist endpoints
│   ├── bizdev/            ← Business Development Strategist endpoints
│   ├── operations/        ← Operations Architect endpoints
│   └── innovation/        ← Product Innovation Officer endpoints
│
├── /lib/connectors/       ← Data ingestion connectors
│   ├── gmail-connector.ts
│   ├── calendar-connector.ts
│   ├── hubspot-connector.ts
│   ├── quickbooks-connector.ts
│   ├── gusto-connector.ts
│   └── grain-connector.ts
│
├── /lib/agents/           ← Agent runtime and utilities
│   ├── agent-runtime.ts   ← Shared agent invocation logic
│   ├── prompt-manager.ts  ← Load agent personas and shared directives from DB
│   ├── tool-registry.ts   ← Agent tool definitions and access control
│   └── command-parser.ts  ← Slack natural language command processing
│
├── /app/api/slack/        ← Extended Slack integration
│   ├── events.ts          ← Slack Events API handler (inbound messages)
│   ├── commands.ts        ← Slack slash command handler
│   └── interactions.ts    ← Slack interactive component handler (buttons, menus)
│
├── /app/(dashboard)/agents/  ← New UI pages
│   ├── activity/          ← Agent activity feed
│   ├── approvals/         ← Approval queue
│   ├── insights/          ← Advisory dashboards
│   └── config/            ← Agent configuration
│
└── New Supabase tables:
    ├── agent_definitions   ← Agent personas, tools, triggers
    ├── agent_outputs       ← All agent work product with approval status
    ├── agent_runs          ← Execution log for debugging
    ├── ingested_data       ← Normalized data from all connectors
    ├── briefings           ← Generated daily briefings
    ├── approval_queue      ← Pending approval items
    └── partner_preferences ← Per-partner EA configuration
```

### Migration Path for Existing Features

| Existing Feature | Evolution |
|-----------------|-----------|
| Meeting prep cron → | Becomes an EA-orchestrated workflow that pulls from all agents |
| Chat tool-calling → | Agents inherit and extend the tool-calling pattern |
| Transcript processing → | Becomes a multi-agent pipeline (extract → route to relevant agents) |
| Slack posting → | Extended to bidirectional with Events API |
| Checkup reminders → | Becomes part of the proactive nudge system |
| RAG over EOS methodology → | Preserved as-is, available to all agents |

## Consequences

**Positive:**
- Zero rebuilding of working features — all existing Ember capabilities preserved
- Shared authentication, database, and deployment infrastructure
- Agents can immediately leverage EOS data, RAG, and transcript processing
- Single codebase for the team (Rich and Wade) to maintain
- Incremental deployment — agent features ship without disrupting existing functionality
- Users (John, Wade) see one application, not two

**Negative:**
- Codebase complexity increases — need clear directory structure discipline
- Vercel serverless may hit limits for long-running agent tasks — may need to explore Vercel Functions with extended duration or background jobs
- Single deployment means agent bugs could theoretically affect existing EOS features — mitigate with proper error isolation

**Technical Debt to Address:**
- Existing Slack integration needs refactoring from write-only to bidirectional
- Current single system prompt for chat needs to evolve into the prompt manager pattern
- Cron jobs need migration from simple scheduled tasks to orchestrator-managed workflows

---

## Implementation Approach

**Week 1:** Add new directories alongside existing code. New Supabase tables. Gmail + Calendar connectors. EA briefing pipeline. Slack Events API handler.

**Weeks 2-4:** Additional connectors. Advisory agent implementations. New UI pages for agent activity and approvals.

**Weeks 5-8:** Migrate existing cron jobs to orchestrator. Extend chat to support agent routing. Build pattern detection engine.

At no point should existing functionality break. The agent layer is purely additive until deliberate migration of existing features.
