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
npm run dev        # Start development server (port 5000)
npm run build      # Build for production
npm run test       # Run test suite
npm run typecheck  # TypeScript validation
npm run lint       # Code linting
```

## Port Configuration

**IMPORTANT:** This project uses ports in the 5000s range only.
- Development server: `http://localhost:5000`
- Always use port 5000-5999 for local development
- Update Supabase redirect URLs to use `http://localhost:5000`

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

- `profiles` - Extended user data
- `vto` - Vision/Traction Organizer (JSONB)
- `rocks` - Quarterly rocks with milestones
- `issues` - Issues with IDS workflow (Identify, Discuss, Solve)
- `todos` - 7-day to-dos from L10 meetings
- `scorecard_metrics` / `scorecard_entries` - Weekly metrics
- `transcripts` / `transcript_chunks` - Meeting transcripts with embeddings
- `chat_messages` - Private chat with row-level security
- `insights` - AI-generated insights

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
