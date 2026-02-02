# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Ember** - AI-powered EOS (Entrepreneurial Operating System) Integrator for Caldera, a three-partner leadership team. Ember acts as a "fourth partner" providing accountability, coaching, and EOS process support.

## Tech Stack (ADR-005)

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend | Next.js API Routes (serverless) |
| Database | Supabase (PostgreSQL + pgvector + Auth + Storage) |
| AI/LLM | Claude API (Anthropic) |
| Auth | Supabase Auth + Google OAuth |
| Hosting | Vercel + Vercel Cron |
| Integrations | Slack Bolt API, HubSpot API |

## Commands

```bash
npm run dev        # Start development server (port 5001)
npm run build      # Build for production
npm run test       # Run test suite
npm run typecheck  # TypeScript validation
npm run lint       # Code linting
```

## Port Configuration

**IMPORTANT:** This project uses ports in the 5000s range only.
- Development server: `http://localhost:5001`
- Port 5000 is reserved by macOS AirPlay, so we use 5001
- Update Supabase redirect URLs to use `http://localhost:5001`

## Project Structure

```
/ember
├── /app                    # Next.js App Router
│   ├── /api               # API routes
│   │   ├── /chat          # Chat endpoints
│   │   ├── /transcripts   # Transcript processing
│   │   ├── /eos           # Rocks, Issues, Scorecard
│   │   └── /integrations  # Slack, HubSpot
│   ├── /dashboard         # Main dashboard pages
│   ├── /chat              # Chat interface
│   └── layout.tsx         # Root layout with auth
├── /components            # React components
├── /lib                   # Shared utilities
│   ├── supabase.ts       # Supabase client
│   ├── claude.ts         # Claude API wrapper
│   ├── embeddings.ts     # Vector operations
│   └── eos.ts            # EOS data operations
├── /types                 # TypeScript types
└── /supabase             # Supabase config
    └── /migrations       # Database migrations
```

## Architecture Patterns

### Frontend: Feature-Sliced Design (FSD)
- Layer hierarchy: `app → pages → widgets → features → entities → shared`
- Public API pattern via `index.ts` re-exports
- Cross-slice imports forbidden (use shared layer)

### Backend: Clean Architecture + DDD + Hexagonal
- Dependency rule: dependencies point inward only (infrastructure → application → domain)
- Domain layer has ZERO external dependencies
- Aggregates per entity, not per table
- Ports (interfaces) defined in domain, adapters in infrastructure

## Key ADR Decisions

1. **ADR-001 AI Persona**: Ember is a "fourth partner" - friendly yet direct, holds team accountable, detects avoidance
2. **ADR-002 Data Ingestion**: Async pipeline (Ingestion → Processing → Storage → Vectors → Insights)
3. **ADR-003 Privacy Model**: Full transparency among partners, private chat for individual prep
4. **ADR-004 Processing**: MVP uses async batch processing, designed for real-time expansion
5. **ADR-005 Tech Stack**: Full stack decisions with database schema

## Database Schema (Core Tables)

- `profiles` - Extended user data (includes `slack_user_id` for Slack @mentions)
- `vto` - Vision/Traction Organizer (JSONB)
- `rocks` - Quarterly rocks with milestones
- `issues` - Issues with IDS workflow (Identify, Discuss, Solve)
- `todos` - 7-day to-dos from L10 meetings
- `scorecard_metrics` / `scorecard_entries` - Weekly metrics
- `transcripts` / `transcript_chunks` - Meeting transcripts with embeddings
- `chat_messages` - Private chat with row-level security
- `insights` - AI-generated insights
- `checkup_periods` / `checkup_responses` / `checkup_completions` - Organizational checkup
- `slack_settings` - Org-level Slack configuration (bot token, channel)
- `organization_members` / `allowed_emails` - Multi-org access control

## Custom Claude Commands

- `/plan` - Generate implementation plan from PRD and ADRs
- `/execute` - Execute tasks from docs/tasks.md
- `/adr` - Manage Architecture Decision Records
- `/bugfix` - Investigate and fix bugs systematically
- `/frontend-dev` - Build React components following conventions
- `/review-pr` - Review GitHub PRs and resolve feedback

## Agent Skills Available

| Skill | Purpose |
|-------|---------|
| feature-slicing | Frontend architecture (FSD pattern) |
| clean-ddd-hexagonal | Backend DDD + Hexagonal patterns |
| postgres-drizzle | Database patterns with Drizzle ORM |
| mermaid-diagrams | Visual documentation |
| modern-javascript | ES6-ES2025 best practices |

## Key Documentation

- `docs/prds/PRD-Ember-AI-Integrator.md` - Complete product requirements
- `docs/adrs/` - All architecture decision records
- `docs/project_plan/Project-Plan.md` - 14-day sprint plan
- `docs/eos_docs/` - EOS methodology materials

## EOS Domain Context

**Core EOS Components:**
- **V/TO** (Vision/Traction Organizer) - Strategic vision document
- **Rocks** - 90-day priorities with owners and milestones
- **Scorecard** - Weekly metrics with targets
- **Issues** - Problems following IDS workflow (Identify, Discuss, Solve)
- **To-dos** - 7-day action items from L10 meetings
- **L10 Meeting** - Weekly 90-minute leadership meeting

**Users:** Rich (Integrator/Finance), John (Sales), Wade (Operations/Delivery)

## Implemented Features

### Global Search (Cmd+K)
- **Location**: `ember/src/components/dashboard/SearchModal.tsx`, `ember/src/lib/search.ts`
- Command palette style modal triggered by Cmd+K / Ctrl+K or header icon
- Searches across rocks, issues, todos, transcripts, and meetings
- Uses PostgreSQL ILIKE pattern matching with parallel queries
- Keyboard navigation (arrow keys, Enter) and category filtering
- Results link to detail pages (`/dashboard/rocks/[id]`, etc.)

### Organizational Checkup (EOS Health Assessment)
- **Location**: `ember/src/app/dashboard/checkup/`
- 20-question assessment covering 6 EOS components (Vision, People, Data, Issues, Process, Traction)
- Individual scoring with team averages and historical comparison
- Auto-save with debounce pattern (see Important Patterns below)
- Admin panel for creating assessment periods

### Slack Integration
- **Location**: `ember/src/lib/slack.ts`, `ember/src/app/api/integrations/slack/`
- OAuth flow for workspace connection
- Reminder cron job for incomplete checkups
- @mention support via `profiles.slack_user_id`

## Important Patterns

### Tailwind v4 Theme Switching
Due to Tailwind v4 CSS specificity, theme switching requires wrapper classes:
```css
/* In globals.css - must use .light/.dark wrappers */
.light { /* light theme variables */ }
.dark { /* dark theme variables */ }
```
See `ember/src/app/globals.css` for full implementation.

### RLS Organization ID Requirement
All create operations MUST explicitly set `organization_id`. The RLS policies use `WITH CHECK` clauses that validate the user belongs to the organization:
```typescript
// In ember/src/lib/eos.ts
export async function createTodo(todo: TodoInsert) {
  const orgId = await getUserOrganizationId(supabase)
  const { data, error } = await supabase
    .from('todos')
    .insert({ ...todo, organization_id: orgId }) // Required!
    .select()
    .single()
}
```

### Auto-Save with Debounce and Race Condition Handling
For forms with auto-save (checkup, VTO), use this pattern to prevent race conditions:
```typescript
// 1. Track changes in ref (not state) to avoid stale closures
const pendingChangesRef = useRef<Record<string, Change>>({})

// 2. Snapshot before save, verify after
const saveChanges = async () => {
  const itemsToSave = { ...pendingChangesRef.current }
  const response = await fetch(...)
  if (response.ok) {
    // Only clear items that haven't been modified since save started
    for (const [id, saved] of Object.entries(itemsToSave)) {
      if (pendingChangesRef.current[id] === saved) {
        delete pendingChangesRef.current[id]
      }
    }
  }
}
```

## Future Plans

See `docs/plans/` for detailed planning documents:
- `docs/plans/wondrous-dancing-eagle.md` - Checkup feature plan with Slack integration phases
