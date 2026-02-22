# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**Ember** - AI-powered strategic operating system for Caldera, a three-partner leadership team (Rich, John, Wade). Part 1 is the EOS platform foundation — Ember as a "fourth partner" providing accountability, coaching, and EOS process support. Part 2 is the Agent System — six specialized AI agents (1 personal EA per partner + 5 shared advisory agents) providing proactive intelligence, automated data ingestion, and strategic advisory across Finance, Marketing, Business Development, Operations, and Product Innovation.

## Tech Stack (ADR-005)

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS v4 |
| Backend | Next.js API Routes (serverless) |
| Database | Supabase (PostgreSQL + pgvector + Auth + Storage) |
| AI/LLM | Claude API (Opus/Sonnet/Haiku) + OpenAI (embeddings) |
| Auth | Supabase Auth + Google OAuth |
| Hosting | Vercel Pro + Vercel Cron |
| Integrations | Slack (bidirectional), Gmail, Calendar, HubSpot, QuickBooks, Gusto, Grain |

## Commands

```bash
npm run dev        # Start development server (port 5001)
npm run build      # Build for production
npm run test       # Run test suite (Vitest)
npm run typecheck  # TypeScript validation
npm run lint       # ESLint with auto-fix
```

## Port Configuration

**IMPORTANT:** This project uses port 5001 (port 5000 is reserved by macOS AirPlay).
- Development server: `http://localhost:5001`
- Supabase redirect URLs must use `http://localhost:5001`

---

## Development Workflow

### Starting New Work

1. **Plan first** - Use `/plan` for multi-step features
2. **Branch** - Create feature branch from main
3. **Execute** - Use `/execute` to work through tasks
4. **Verify** - Use `/quality-gate` before committing
5. **Review** - Use `superpowers:requesting-code-review` for significant changes

### Quality Gates (Required Before PR)

| Check | Command | Required |
|-------|---------|----------|
| TypeScript | `npm run typecheck` | Zero errors |
| Lint | `npm run lint` | Zero errors |
| Tests | `npm run test` | All pass |
| Build | `npm run build` | Success |

Run `/quality-gate` to execute all checks.

### Commit Standards

```bash
type(scope): description

# Types: feat, fix, refactor, test, docs, chore
# Example: feat(rocks): add milestone tracking
```

---

## Project Commands (`.claude/commands/`)

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/plan` | Generate implementation plan from PRD | Starting new features |
| `/execute` | Execute tasks from docs/tasks.md | Implementing planned work |
| `/adr` | Manage Architecture Decision Records | Documenting decisions |
| `/bugfix` | Investigate and fix bugs | Debugging issues |
| `/frontend-dev` | Build React components | Creating UI |
| `/review-pr` | Review GitHub PRs | Addressing feedback |
| `/sync-grain` | Sync transcripts from Grain | Importing meeting data |
| `/quality-gate` | Run all quality checks | Before commits/PRs |

---

## Project Skills (`.claude/skills/`)

| Skill | Location | Purpose |
|-------|----------|---------|
| EOS Domain | `eos-domain-skill/` | EOS business rules, validation, coaching prompts |
| Plan Management | `plan-management/` | Templates for plans and task lists |
| Frontend Dev | `frontend-dev/` | Design tokens, component patterns |
| ADR Management | `adr-management/` | ADR templates and discussion guides |

### EOS Domain Knowledge

When working on Rocks, Scorecard, Issues, To-Dos, L10 Meetings, V/TO:
- **Read first**: `.claude/skills/eos-domain-skill/SKILL.md`
- Contains canonical EOS rules from *Traction*
- Ember persona guidelines for AI prompts

---

## Global Skills (Available Everywhere)

| Skill | When to Use |
|-------|-------------|
| `superpowers:writing-plans` | Before multi-step implementation |
| `superpowers:test-driven-development` | Before writing implementation code |
| `superpowers:systematic-debugging` | When encountering bugs |
| `superpowers:verification-before-completion` | Before claiming work complete |
| `superpowers:requesting-code-review` | Before merging significant changes |
| `superpowers:brainstorming` | Before creative/design work |
| `feature-dev:feature-dev` | Guided feature development |
| `vercel:deploy` | Deploying to production |

---

## MCP Plugins

| Plugin | Purpose | Key Tools |
|--------|---------|-----------|
| **Context7** | Library documentation | `resolve-library-id`, `query-docs` |
| **Grain** | Meeting transcripts | `search_meetings`, `fetch_meeting_transcript` |
| **Playwright** | Browser automation | `browser_navigate`, `browser_snapshot` |

### Using Context7

Before implementing with any library:
```
1. mcp__context7__resolve-library-id (find library)
2. mcp__context7__query-docs (get current docs)
```

### Using Grain

Sync meeting transcripts for EOS entity extraction:
```
/sync-grain list       # See available meetings
/sync-grain sync <id>  # Import transcript
```

---

## Project Structure

```
/ember
├── /src
│   ├── /app                # Next.js App Router
│   │   ├── /api           # API routes
│   │   │   ├── /eos       # EOS entity CRUD (34+ routes)
│   │   │   ├── /chat      # Ember chat (streaming + tools)
│   │   │   ├── /agents    # NEW: Agent system routes
│   │   │   │   ├── /cron  # Scheduled agent invocations
│   │   │   │   ├── /ea    # Executive Assistant
│   │   │   │   └── /events # Webhook handlers
│   │   │   └── /integrations # Slack, etc.
│   │   ├── /dashboard     # Main dashboard pages
│   │   └── layout.tsx     # Root layout with auth
│   ├── /components        # React components
│   │   ├── /ui           # Primitives (Button, Card, etc.)
│   │   ├── /dashboard    # Dashboard-specific
│   │   └── /{feature}    # Feature-specific
│   ├── /lib              # Shared utilities
│   │   ├── /agents       # NEW: Agent runtime, prompt manager, tool registry
│   │   └── /connectors   # NEW: Gmail, Calendar, HubSpot, QuickBooks, etc.
│   └── /types            # TypeScript types
├── /supabase             # Database config
│   └── /migrations       # SQL migrations
└── /docs                 # Product & architecture documentation
```

---

## Architecture Patterns

### Frontend: Feature-Sliced Design
- Layer hierarchy: `app → pages → widgets → features → entities → shared`
- Public API via `index.ts` re-exports
- Cross-slice imports forbidden

### Backend: Clean Architecture + DDD
- Dependencies point inward (infrastructure → application → domain)
- Domain layer has zero external dependencies
- Ports (interfaces) in domain, adapters in infrastructure

---

## Key ADR Decisions

**Foundation (v1.0 + v2.0 addendums):**

| ADR | Decision |
|-----|----------|
| ADR-001 | Ember is a "fourth partner" - unified persona across all agent capabilities |
| ADR-002 | Centralized ingestion pipeline with tiered freshness (real-time/near-RT/batch) |
| ADR-003 | Three-zone trust model: autonomous / approval-required / prohibited |
| ADR-004 | Async-first with overnight batch → morning briefing pattern |
| ADR-005 | Next.js + Supabase + Claude (multi-model) + Vercel Pro |

**Agent System (v2.0):**

| ADR | Decision |
|-----|----------|
| ADR-006 | Orchestrated agent pool with central dispatcher |
| ADR-007 | Slack-first interaction model — Ember UI for deep work |
| ADR-008 | Agent system extends Ember platform, not a separate system |
| ADR-009 | All agent outputs map to EOS constructs — agents are EOS-native |
| ADR-010 | Business model transformation is a cross-cutting agent concern |

---

## Database Schema (Core Tables)

| Table | Purpose |
|-------|---------|
| `profiles` | Extended user data (includes `slack_user_id`) |
| `rocks` | Quarterly rocks with milestones |
| `issues` | Issues with IDS workflow |
| `todos` | 7-day to-dos from L10 meetings |
| `scorecard_metrics` / `scorecard_entries` | Weekly metrics |
| `transcripts` / `transcript_chunks` | Meeting transcripts with embeddings |
| `chat_messages` | Private chat with RLS |

---

## Important Patterns

### Tailwind v4 Theme Switching

Dark mode via `.dark` class wrapper:
```css
.dark { /* dark theme variables */ }
```
See `ember/src/app/globals.css` for implementation.

### RLS Organization ID Requirement

All create operations MUST set `organization_id`:
```typescript
const orgId = await getUserOrganizationId(supabase)
await supabase.from('todos').insert({ ...todo, organization_id: orgId })
```

### Auto-Save with Race Condition Handling

```typescript
const pendingChangesRef = useRef<Record<string, Change>>({})
// Snapshot before save, verify after
```
See checkup feature for full implementation.

---

## Implemented Features

### Global Search (Cmd+K)
- **Location**: `components/dashboard/SearchModal.tsx`, `lib/search.ts`
- Command palette searching rocks, issues, todos, transcripts
- PostgreSQL ILIKE with parallel queries

### Organizational Checkup
- **Location**: `app/dashboard/checkup/`
- 20-question EOS health assessment
- Auto-save with debounce pattern

### Slack Integration
- **Location**: `lib/slack.ts`, `app/api/integrations/slack/`
- OAuth flow, reminder cron, @mention support

---

## EOS Domain Context

**Core Components:**
- **V/TO** - Vision/Traction Organizer
- **Rocks** - 90-day priorities (3-7 per person)
- **Scorecard** - Weekly metrics (5-15 metrics)
- **Issues** - Problems with IDS workflow
- **To-dos** - 7-day action items
- **L10** - Weekly 90-minute meeting

**Key Rules:**
- Rocks: 3-7 per person, one owner, 80% completion target
- To-dos: 7-day duration, 90% completion target
- Scorecard: "On track" or "off track" only, no discussion during review
- L10: 90 minutes hard stop, IDS gets 60 minutes

**Users:** Rich (Integrator/Finance), John (Sales), Wade (Operations/Delivery)

---

## Documentation

| Document | Location |
|----------|----------|
| Documentation Index | `docs/README.md` |
| Product Requirements (v2.0) | `docs/prds/PRD-Ember-v2.md` |
| Architecture Decisions (10 ADRs) | `docs/adrs/` |
| System Design Document | `docs/System-Design-Document.md` |
| Integration Documentation | `docs/Integration-Documentation.md` |
| Implementation Plans | `docs/plans/` |
| Archived v1.0 Docs | `docs/archive/v1.0/` |
| EOS Reference | `.claude/skills/eos-domain-skill/` |
