# CLAUDE.md Template

Use this template when generating or updating `CLAUDE.md` for the project.

---

```markdown
# {Project Name} - Claude Code Instructions

## Project Overview

{One paragraph describing what this project does - pulled from PRD overview. Include target users and key capabilities.}

## Key Documents

| Document                                     | Purpose                        |
| -------------------------------------------- | ------------------------------ |
| [docs/PRD.md](docs/PRD.md)                   | Product Requirements Document  |
| [docs/product-plan.md](docs/product-plan.md) | Product strategy and roadmap   |
| [docs/adrs/](docs/adrs/)                     | Architecture Decision Records  |
| [docs/plan.md](docs/plan.md)                 | Technical implementation plan  |
| [docs/tasks.md](docs/tasks.md)               | Current task list and progress |

## Technology Stack

| Layer          | Technology                           | ADR      |
| -------------- | ------------------------------------ | -------- |
| Runtime        | Node.js {version}                    | -        |
| Framework      | {e.g., Next.js 14 with App Router}   | ADR-0100 |
| Language       | TypeScript {version}, strict mode    | -        |
| Database       | {e.g., PostgreSQL 15+ with pgvector} | ADR-0101 |
| ORM            | {e.g., Drizzle}                      | ADR-0001 |
| Authentication | {e.g., BetterAuth}                   | ADR-0102 |
| Styling        | {e.g., Tailwind CSS}                 | ADR-0103 |
| Testing        | {e.g., Vitest + Playwright}          | ADR-0009 |

## Project Structure
```

{Project structure from ADR-010 or as defined in plan}
src/
├── app/ # Next.js App Router pages
├── components/ # React components
│ ├── ui/ # Primitive/shared components
│ └── features/ # Feature-specific components
├── lib/ # Utilities and helpers
├── services/ # Business logic
├── db/ # Database schema and queries
└── types/ # TypeScript type definitions
tests/
├── unit/ # Unit tests
└── e2e/ # End-to-end tests
docs/
└── adrs/ # Architecture Decision Records

````

## Available Commands

### Development

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run start      # Start production server
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript compiler check
npm run format     # Format code with Prettier
````

### Testing

```bash
npm run test       # Run all tests
npm run test:unit  # Run unit tests only
npm run test:e2e   # Run E2E tests
npm run test:watch # Run tests in watch mode
```

### Database

```bash
npm run db:migrate # Run migrations
npm run db:push    # Push schema changes (dev)
npm run db:studio  # Open database GUI
```

### Claude Code Skills

```
/adr               # Manage Architecture Decision Records
/adr status        # View ADR progress
/plan              # Generate implementation plan
/plan refresh      # Update plan preserving progress
/execute           # Execute next task from docs/tasks.md
/execute phase     # Execute entire current phase
```

## Design Principles

{Pull from PRD design principles}

1. **{Principle 1}** - {Brief explanation}
2. **{Principle 2}** - {Brief explanation}
3. **{Principle 3}** - {Brief explanation}

## Code Conventions

### General

- Use ES modules (import/export), not CommonJS
- Prefer named exports over default exports
- Use early returns to reduce nesting
- Maximum file length: 300 lines (split if larger)

### TypeScript

- Strict mode enabled - no `any` types
- Define interfaces for all props and function parameters
- Use `type` for unions/intersections, `interface` for object shapes
- Prefer `unknown` over `any` when type is truly unknown

### React (if applicable)

- Functional components only
- Props interface named `{Component}Props`
- Use server components by default (App Router)
- Colocate component, styles, and tests when possible

### Testing

- Test file naming: `{name}.test.ts` or `{name}.spec.ts`
- Each function/component should have at least one test
- Use descriptive test names: "should {behavior} when {condition}"
- Prefer integration tests over unit tests for UI

### Git

- Commit after each completed task
- Commit message format: `type(scope): description`
- Types: feat, fix, refactor, test, docs, chore
- Include task number in commit: `feat(auth): add login form (1.2.1)`

## Architecture Decisions

Key decisions are documented in `docs/adrs/`. Read these before making changes to:

{List areas covered by completed ADRs}

- Database queries and schema → ADR-0001
- Background job processing → ADR-0002
- Real-time updates → ADR-0003
- {Continue for all accepted ADRs...}

## Current Focus

See [docs/tasks.md](docs/tasks.md) for current implementation status.

**Current Phase:** {Phase N}
**MVP Status:** {Not Started | In Progress | Complete}

## Session Protocol

### Starting a Session

1. Read this file (CLAUDE.md)
2. Read docs/tasks.md to find next incomplete task
3. State which task you'll work on
4. State your implementation approach
5. Wait for approval before writing code

### During Implementation

1. Work on ONE task at a time
2. Write code following conventions above
3. Run `npm run test` and `npm run typecheck`
4. If tests fail, fix before continuing
5. Mark task complete in docs/tasks.md immediately

### Completing a Task

1. Ensure all tests pass
2. Mark task as complete in docs/tasks.md
3. Update Task Log with date and commit hash
4. Commit with descriptive message
5. Stop and report what you did

### If Uncertain

- Ask clarifying questions before implementing
- Reference ADRs for architectural guidance
- When in doubt, prefer simpler solutions
- Check docs/plan.md for phase goals and context

## Do NOT

- Modify multiple tasks without approval
- Skip tests or type checking
- Make architectural changes not covered by ADRs
- Install new dependencies without discussing first
- Create files outside the defined structure
- Use `any` types in TypeScript
- Write code that doesn't match existing patterns

## Environment Variables

Required variables (see .env.example):

```
DATABASE_URL=          # PostgreSQL connection string
{Other required vars from PRD}
```

Optional variables:

```
{Optional vars}
```

## Troubleshooting

### Common Issues

**Database connection fails:**

- Ensure PostgreSQL is running
- Check DATABASE_URL in .env

**Tests fail on fresh clone:**

- Run `npm install`
- Run `npm run db:migrate`
- Check .env has all required variables

**TypeScript errors:**

- Run `npm run typecheck` for details
- Ensure strict mode is respected

```

---

## Template Usage Notes

### When to Update CLAUDE.md

Update during `/plan` when:
- Tech stack changes based on ADRs
- Project structure is defined
- New commands are available
- Conventions are established

Update during `/plan refresh` when:
- ADRs change tech decisions
- Project structure evolves
- New patterns emerge

### Section Priority

Always include:
1. Project Overview
2. Tech Stack
3. Commands
4. Session Protocol
5. Do NOT section

Include if applicable:
- Project Structure (after ADR-010)
- Code Conventions (project-specific)
- Environment Variables

### Linking to ADRs

Reference ADR numbers for:
- Tech stack choices
- Structural decisions
- Pattern choices

Format: `→ ADR-0001` or `See ADR-0001`

### Session Protocol

The session protocol is critical for consistent AI-assisted development. Include:
- Clear start/stop procedures
- Single-task focus
- Approval gates
- Error handling
```
