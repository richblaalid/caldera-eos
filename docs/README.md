# Ember Documentation Suite — Unified v2.0

**Company:** Caldera — Software Design & Development Services
**Partners:** Rich (CEO/Integrator), John (Sales), Wade (Engineering)
**Last Updated:** February 22, 2026

---

## Document Index

### Product Requirements Document

**[PRD-Ember-v2.md](./prds/PRD-Ember-v2.md)** — Unified product requirements document covering both the EOS platform foundation (Part 1) and the Agent System strategic advisory layer (Part 2). This is the single source of truth for what Ember is and what it does.

*Supersedes: PRD v1.0 (January 30, 2025). All original content preserved in Part 1 with v2.0 enhancements noted inline.*

---

### Architecture Decision Records

**Original Decisions (January 2025) — Updated with v2.0 Addendums:**

| ADR | Title | Summary | Addendum |
|-----|-------|---------|----------|
| [ADR-001](./adrs/ADR-001-AI-Persona-Interaction-Model.md) | AI Persona & Interaction Model | Ember as "fourth partner" with multi-channel presence | Multi-agent capabilities under unified Ember persona; Slack elevated to primary interface |
| [ADR-002](./adrs/ADR-002-Data-Ingestion-Architecture.md) | Data Ingestion Architecture | Multi-source ingestion with vector storage | Centralized pipeline with connectors, unified ingested_data table, tiered freshness model |
| [ADR-003](./adrs/ADR-003-Privacy-Access-Model.md) | Privacy & Access Model | Transparency default, private chat, strict external boundary | Three-zone trust model (autonomous/approval/prohibited), approval workflow, personal vs. shared agent scopes |
| [ADR-004](./adrs/ADR-004-Realtime-vs-Async-Processing.md) | Real-time vs. Async Processing | Phased approach: async first, architect for real-time | Agent system implements Phase 1-2; overnight batch → morning briefing pattern |
| [ADR-005](./adrs/ADR-005-Technology-Stack.md) | Technology Stack | Next.js + Supabase + Claude + Vercel | Multi-model strategy, new API integrations, extended project structure, Vercel Cron additions |

**New Decisions (February 2026) — Agent System:**

| ADR | Title | Summary |
|-----|-------|---------|
| [ADR-006](./adrs/ADR-006-Agent-Architecture-Pattern.md) | Agent Architecture Pattern | Orchestrated agent pool with central dispatcher, scheduled/event/request invocations |
| [ADR-007](./adrs/ADR-007-Slack-First-Interaction.md) | Slack-First Interaction Model | Slack as primary interface with NL command processing; Ember UI for deep work |
| [ADR-008](./adrs/ADR-008-Extend-Ember-Platform.md) | Extend Ember Platform | Agent system built as extension of existing Ember, not a separate system |
| [ADR-009](./adrs/ADR-009-EOS-Process-Integration.md) | EOS Process Integration | All agent outputs map to EOS constructs; L10 ceremony support; proactive nudge escalation |
| [ADR-010](./adrs/ADR-010-Business-Model-Transformation.md) | Business Model Transformation Support | Cross-cutting agent support for shift from T&M to value-based fixed-fee |

---

### Technical Documentation

| Document | Contents |
|----------|----------|
| [System-Design-Document.md](./System-Design-Document.md) | Full technical architecture: agent runtime, orchestrator design, database schema (new tables), API route structure, model selection strategy, error handling, security |
| [Integration-Documentation.md](./Integration-Documentation.md) | Service-by-service integration specs: Gmail, Calendar, Drive, Slack, HubSpot, QuickBooks, Gusto, Grain. Auth methods, data flows, cross-integration patterns, rate limits |

---

## Architecture Summary

```
Six Agents:
  1 Personal EA (per partner) — chief of staff, briefings, approvals
  5 Shared Advisors:
    • Financial Strategist (fractional CFO)
    • Marketing Strategist (fractional CMO)
    • Business Development Strategist (VP Partnerships)
    • Operations Architect (VP Operations)
    • Product Innovation Officer (internal venture strategist)

Data Sources: Slack, Gmail, Calendar, Drive, HubSpot, QuickBooks, Gusto, Grain
Primary Interface: Slack (ambient) + Ember UI (deep work) + Claude Code (Rich's workbench)
Operating Rhythm: EOS (Traction) — all outputs map to EOS constructs
Governance: Autonomous internal, human-approved external, prohibited financial/HR/access
```

## Week 1 Build Plan

| Day | Focus | Deliverable |
|-----|-------|-------------|
| 1 | EA data ingestion | Gmail + Calendar connectors, bidirectional Slack |
| 2 | Morning briefing V1 | Three-tier briefing generation + Slack delivery |
| 3 | Slack command processing | Natural language reply parsing + state updates |
| 4 | Financial Strategist V1 | QuickBooks connector + margin analysis + alerts |
| 5 | Integration test + demo | End-to-end loop working, partner feedback |

---

## How This Documentation Set Works

**PRD** is the "what and why" — read this first for the full picture.

**ADRs** are the "why this approach" — each captures a specific architectural decision with context, alternatives considered, and consequences. ADRs 001-005 are foundational decisions from the original build. ADRs 006-010 are agent system decisions. The original ADRs have v2.0 addendums showing how the agent system extends them.

**Technical docs** are the "how" — read these when building. The System Design Document covers internal architecture. The Integration Documentation covers external service connections.

**All documents are living.** Update them as decisions change. Add new ADRs for significant architectural choices. Version the PRD for major scope changes.
