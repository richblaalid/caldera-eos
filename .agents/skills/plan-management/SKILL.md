---
name: plan-management
description: |
  Generate technical implementation plans and granular task lists from PRD and ADR documents.
  Triggers on: planning, task breakdown, implementation plan, project planning, sprint planning,
  task generation, backlog creation, phase planning.

  Use when: starting a new project, creating implementation plans from requirements,
  breaking down features into tasks, refreshing plans after requirement changes.
---

# Plan Management Skill

Generate technical implementation plans and granular task lists from PRD and ADR documents, preparing projects for incremental AI-assisted development.

---

## Core Workflow

```
PRD + ADRs → Technical Plan → Task List → Execution
```

### Input Documents
- `docs/prds/*.md` — Product requirements
- `docs/adrs/*.md` — Architecture decisions

### Output Documents
- `docs/plan.md` — Technical implementation plan
- `docs/tasks.md` — Granular task list with checkboxes

---

## Planning Principles

### Task Granularity
- Each task: **10-15 minutes** of focused work
- One clear outcome per task
- Testable completion criteria
- Reference affected files when known

### Phase Structure
- **Phase 0**: Project scaffolding (always first)
- **Phases 1-N**: Feature implementation
- Clear checkpoints between phases
- MVP boundary explicitly marked

### Task Numbering
```
{phase}.{group}.{task}

Examples:
0.1.1 — Phase 0, Group 1, Task 1
1.2.3 — Phase 1, Group 2, Task 3
```

---

## Quick Decision Trees

### "How granular should tasks be?"

```
Task Size Check:
├─ Can complete in one sitting (10-15 min)?     → Good size
├─ Requires multiple files/concepts?            → Split it
├─ Has multiple acceptance criteria?            → Split it
├─ "And then..." in description?                → Split it
└─ Single clear action?                         → Good size
```

### "What goes in which document?"

```
Document Placement:
├─ WHY decisions, architecture context          → docs/plan.md
├─ WHAT to do, step-by-step                     → docs/tasks.md
├─ HOW to work in this codebase                 → CLAUDE.md
└─ Requirements and vision                      → docs/prds/*.md
```

---

## Reference Documentation

| File | Purpose |
|------|---------|
| [references/PLAN-TEMPLATE.md](references/PLAN-TEMPLATE.md) | Template for docs/plan.md |
| [references/TASKS-TEMPLATE.md](references/TASKS-TEMPLATE.md) | Template for docs/tasks.md |
| [references/CLAUDE-TEMPLATE.md](references/CLAUDE-TEMPLATE.md) | Template for CLAUDE.md updates |
| [references/CHEATSHEET.md](references/CHEATSHEET.md) | Quick reference for planning |

---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|--------------|---------|-----|
| Vague tasks | "Set up auth" | "Create Supabase auth client in lib/supabase.ts" |
| Compound tasks | "Build and test login" | Split into build task + test task |
| Missing files | No file references | Include affected files when known |
| Phase overload | 20 tasks in one phase | Max 10-15 tasks per phase |
| Skipping Phase 0 | Jump to features | Always scaffold first |

---

## Constraints

- **No code during planning** — Research and document only
- **Preserve completed tasks** — On refresh, keep checked items
- **Explicit MVP boundary** — Mark what's in/out of MVP
- **Phase checkpoints** — Define verification criteria
