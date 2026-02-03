# ADR Management Cheatsheet

## Quick Reference

### File Naming
```
ADR-{NNN}-{Descriptive-Title}.md
Location: docs/adrs/
```

### Status Values
| Status | When to Use |
|--------|-------------|
| Draft | Work in progress |
| Proposed | Ready for discussion |
| Accepted | Decision made |
| Rejected | Not adopted |
| Deprecated | No longer applies |
| Superseded | Replaced by newer ADR |

---

## Command Quick Reference

| Command | Action |
|---------|--------|
| `/adr` | Show ADR status |
| `/adr next` | Work on next pending ADR |
| `/adr new <topic>` | Create new ADR |
| `/adr 001` | Work on specific ADR |
| `/adr identify` | Find decisions needing ADRs |

---

## ADR Structure

```markdown
# ADR-NNN: Title

**Status:** Accepted
**Date:** YYYY-MM-DD
**Decision Makers:** Names

## Context
{Why this decision is needed}

## Decision
{What we decided}

## Rationale
{Why we chose this}

## Consequences
{What results from this}

## Alternatives Considered
{Other options we evaluated}
```

---

## Current ADRs (Ember)

| # | Topic | Status |
|---|-------|--------|
| 001 | AI Persona & Interaction Model | Accepted |
| 002 | Data Ingestion Architecture | Accepted |
| 003 | Privacy & Access Model | Accepted |
| 004 | Real-time vs Async Processing | Accepted |
| 005 | Technology Stack | Accepted |

---

## Write an ADR When...

- Choosing between technologies
- Establishing team patterns
- Making tradeoffs
- Decision might be questioned later
- Multiple components affected

## Don't Write an ADR When...

- Implementation details only
- Obvious choice, no alternatives
- Bug fixes or minor refactors
- Temporary solutions

---

## Good ADR Title Examples

```
ADR-006-Background-Job-Processing
ADR-007-Error-Handling-Strategy
ADR-008-Caching-Layer
ADR-009-Logging-and-Monitoring
```

## Bad ADR Title Examples

```
ADR-006-Stuff          # Too vague
ADR-007-We-Should-Use-Redis  # Decision in title
ADR-008-Fix-The-Bug    # Not architectural
```
