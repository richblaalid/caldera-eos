# Plan Template

Use this template when generating `docs/plan.md` from PRD and ADR documents.

---

```markdown
# Technical Implementation Plan

> Generated from docs/PRD.md and docs/adrs/ on {DATE}
> Last updated: {DATE}

## Overview

{2-3 sentence summary of what we're building and the core technical approach. Reference the PRD's project description and key design principles.}

## Architecture Summary

{Brief description of the system architecture, referencing key ADRs by number.}

### Key Components

| Component | Responsibility | Key Technologies  |
| --------- | -------------- | ----------------- |
| {Name}    | {What it does} | {Stack from ADRs} |
| {Name}    | {What it does} | {Stack from ADRs} |
| {Name}    | {What it does} | {Stack from ADRs} |

### Data Flow

{Describe how data moves through the system. Can be prose or simple notation like:}
```

User → Next.js App Router → API Routes → Services → PostgreSQL
↓
Background Jobs → File Processing → pgvector

```

## Implementation Phases

### Phase 0: Project Foundation

**Goal:** Runnable project skeleton with dev tooling

- Initialize Next.js 14+ project with App Router
- Configure TypeScript strict mode
- Set up ESLint and Prettier
- Configure test framework per ADR-009
- Create folder structure per ADR-010
- Set up database connection with ORM per ADR-001
- Verify: `npm run dev`, `npm run test`, `npm run build` all work

### Phase 1: {Core Feature Name - from PRD Phase 1}

**Goal:** {What this phase achieves - align with PRD MVP scope}
**Depends on:** Phase 0

- {High-level work item from PRD}
- {High-level work item from PRD}
- {High-level work item from PRD}
- Verify: {How we know this phase is complete - concrete criteria}

### Phase 2: {Feature Name - from PRD Phase 1 or 2}

**Goal:** {What this phase achieves}
**Depends on:** Phase {N}

- {High-level work item}
- {High-level work item}
- Verify: {Concrete completion criteria}

{Continue phases as needed, aligning with PRD development phases...}

---

## MVP Boundary

**MVP includes:** Phases 0-{X}
**Post-MVP:** Phases {X+1}+

**MVP is complete when:**

- [ ] {Concrete acceptance criterion from PRD}
- [ ] {Concrete acceptance criterion from PRD}
- [ ] {Concrete acceptance criterion from PRD}
- [ ] All Phase 0-{X} checkpoints pass
- [ ] Application can be deployed and used for core workflows

## External Dependencies

| Dependency | Purpose | Version | Documentation |
|------------|---------|---------|---------------|
| {Package} | {Why we need it} | {Version} | {Link} |
| {Service} | {Why we need it} | - | {Link} |

## Open Questions

{List any unresolved decisions that may affect implementation. Reference missing ADRs if applicable.}

- [ ] {Question that needs resolution}
- [ ] {Question that needs resolution}

## ADR References

{Link to all relevant ADRs that inform this plan.}

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-0001](docs/adrs/ADR-0001-*.md) | {Title} | {Status} |
| [ADR-0002](docs/adrs/ADR-0002-*.md) | {Title} | {Status} |
{Continue for all relevant ADRs...}

## PRD Alignment

This plan implements the following PRD sections:

- **Section 2**: Technology Stack → Phase 0
- **Section 3**: Feature Requirements → Phases 1-{N}
- **Section 4**: API Requirements → Phases {N}-{M}
- **Section 5**: Non-Functional Requirements → Throughout

## Notes for Implementation

{Any additional context that will help during implementation. Include:}

- Key design principles to follow
- Known constraints or limitations
- Integration points to be careful about
- Performance considerations
```

---

## Template Usage Notes

### Phase Alignment

Map phases to PRD development phases:

| PRD Phase     | Plan Phases | Scope                      |
| ------------- | ----------- | -------------------------- |
| Phase 1 (MVP) | 0-N         | Foundation + core features |
| Phase 2       | N+1-M       | Workspaces, multi-user     |
| Phase 3       | M+1-P       | Plugin system              |
| Phase 4       | P+1+        | Automation                 |

### MVP Boundary

The MVP boundary should:

- Align with PRD Phase 1 requirements
- Include all "must have" features
- Exclude "nice to have" features
- Be achievable with completed ADRs

### External Dependencies

Include:

- npm packages beyond standard Next.js
- Database systems (PostgreSQL)
- External services (LLM APIs, S3)
- Development tools (Docker, etc.)

### Open Questions

Add items here when:

- An ADR is pending that affects implementation
- PRD has ambiguous requirements
- Technical decisions need user input
- Integration details are unclear

### Verification Criteria

Each phase verification should be:

- Concrete and testable
- Not dependent on subjective judgment
- Runnable as a checklist
