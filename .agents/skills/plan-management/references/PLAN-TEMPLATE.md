# Plan Template

Use this template for `docs/plan.md`.

---

```markdown
# {Project Name} Implementation Plan

## Overview

{1-2 paragraph summary of what we're building and the technical approach}

## Technical Decisions

Summary of key ADRs affecting implementation:

| Decision | Choice | ADR |
|----------|--------|-----|
| {Area} | {Technology/Approach} | ADR-00X |

## Architecture

{Brief description of system architecture}

```
{ASCII diagram or reference to architecture diagram}
```

## Phases

### Phase 0: Foundation
**Goal:** {What this phase accomplishes}
**Checkpoint:** {How to verify phase is complete}

### Phase 1: {Name}
**Goal:** {What this phase accomplishes}
**Checkpoint:** {How to verify phase is complete}

{Continue for each phase...}

---
**MVP Boundary:** Phases 0-{N} constitute the MVP.
---

### Phase {N+1}: {Post-MVP Name}
{Future phases after MVP}

## Dependencies

| Dependency | Required For | Setup |
|------------|--------------|-------|
| {Service/Tool} | {Phase/Feature} | {How to set up} |

## Environment Variables

```env
# Required for Phase {N}
{VAR_NAME}=

# Required for Phase {M}
{VAR_NAME}=
```

## Risk Areas

| Risk | Phase | Mitigation |
|------|-------|------------|
| {Potential issue} | {Affected phase} | {How to handle} |

## Notes

{Any additional context, gotchas, or considerations}
```
