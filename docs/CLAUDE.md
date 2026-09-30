# Documentation System — Agent Orientation

Project: **Ember** for **Caldera**. Convention: `flat` (see `delivery.config.json`). One set of docs, no feature folders.

## Document Hierarchy

```
Grounding Extracts (docs/grounding/extracts/)
  ├─► DR (docs/decisions/) ──► requirements.md | architecture.md | tests.md
  └─► Direct edits ──► requirements.md | architecture.md | tests.md | plan.md | glossary.md
```

Decision Records (DRs) are the single artifact type for architectural, product, and scoping decisions. Docs are edited surgically, never regenerated.

## Documents

| File | Holds |
|------|-------|
| `requirements.md` | Vision, scope, and requirements grouped by area (`## Area` headings) |
| `architecture.md` | Stack, structure, integration points, key patterns |
| `tests.md` | Behavior-driven acceptance criteria, grouped to mirror requirements |
| `plan.md` | Milestones and sequencing |
| `tasks.md` | The single task list, grouped by `### Group` headings |
| `glossary.md` | Domain terminology — load before processing docs |
| `backlog.md` | Deferred items from grounding triage |

## Supersession Rules

Only the current version of a DR lives in the tree; superseded versions are deleted and git history is the archive. Filename `DR-YYYY-MM-DD-[topic]-v[N].md`, inline Changelog. Check for a newer version before trusting anything that cites a DR.

## Routing

Raw client signal → `/delivery:ground`. Decisions → `/delivery:decide`. Tasks → `/delivery:implement`. Status → `/delivery:report`.

Use `/delivery:decide` when a change picks between alternatives with consequences, restructures data or concepts, changes scope, or supersedes a prior DR. Direct edit for clarifications and factual updates.

## Acceptance Criteria Principle

ACs describe observable behavior, not implementation.

## Tasks

`tasks.md` uses `| ID | Task | Status | Depends On | Notes |` with Status in Not Started / In Progress / Done / Deferred. Rows under `## Completed Tasks` are Done. `### Group` headings are the reporting unit.

## File Size Rules

~400 lines max per file. When `requirements.md` outgrows that, switch to the `feature-sliced` convention with `/delivery:init feature-sliced`.

## Templates

Templates are authoritative in the `delivery` plugin's skills — do not copy them here.

## Adopted layout

This project adopted its existing docs rather than the `flat` scaffold. The generic filenames above map to these actual paths; `delivery.config.json` is authoritative.

| Role | Path |
|------|------|
| Requirements (`prd`) | `docs/prds/PRD-Ember-v2.md` |
| Architecture (`tech`) | `docs/System-Design-Document.md` |
| Plan | `docs/project_plan/Project-Plan.md` |
| Tasks (delivery table format) | `docs/delivery-tasks.md` |
| Decision records + ADRs | `docs/adrs/` (impact reports in `docs/adrs/impact-reports/`) |
| Backlog | `docs/backlog.md` |
| Grounding | `docs/grounding/` (`raw/`, `extracts/`, `open-questions.md`) |
| Progress reports | `docs/progress/` |
| Tests, glossary, screens, design system, schema, SOW | none |

Notes:
- `docs/adrs/` holds both the original `ADR-NNN-*.md` records (ADR-001 to ADR-010) and new `DR-YYYY-MM-DD-*.md` records. Treat both as decision records when checking for related or superseded decisions.
- `docs/tasks.md` is the historical phase task list in checkbox format. It is not parsed by `/delivery:implement` or `/delivery:report`; new delivery-tracked work goes in `docs/delivery-tasks.md`.
- Validation gates run from `ember/`: `npm run lint`, `npm run build`, `npm run test`.
