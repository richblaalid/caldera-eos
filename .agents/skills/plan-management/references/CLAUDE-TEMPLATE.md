# CLAUDE.md Template

Use this template when creating or updating `CLAUDE.md`.

---

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

{1-2 sentences: What this project is and its primary purpose}

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | {e.g., Next.js 14 + TypeScript} |
| Styling | {e.g., Tailwind CSS} |
| Backend | {e.g., Next.js API Routes} |
| Database | {e.g., Supabase (PostgreSQL)} |
| Auth | {e.g., Supabase Auth + Google OAuth} |
| AI | {e.g., Claude API} |

## Commands

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run test       # Run tests
npm run typecheck  # TypeScript validation
npm run lint       # Code linting
```

## Project Structure

```
{project-name}/
├── app/                # {Description}
│   ├── api/           # {Description}
│   └── ...
├── components/        # {Description}
├── lib/              # {Description}
└── types/            # {Description}
```

## Architecture Patterns

{Key patterns used in the codebase}

### Frontend
- {Pattern name}: {Brief description}

### Backend
- {Pattern name}: {Brief description}

## Key ADR Decisions

{Numbered list of key architecture decisions with brief summaries}

## Database Schema

{List core tables and their purposes}

## Domain Context

{Domain-specific terminology and concepts needed to understand the codebase}

## Custom Commands

{List any custom Claude commands available}

## Key Documentation

- `docs/prds/` — Product requirements
- `docs/adrs/` — Architecture decisions
- `docs/plan.md` — Implementation plan
- `docs/tasks.md` — Task list
```

---

## Guidelines

1. **Keep it focused** — Only include what helps Claude work effectively
2. **Avoid obvious** — Don't include generic best practices
3. **Update on changes** — Refresh when stack or patterns change
4. **Reference don't duplicate** — Point to docs, don't copy them
