---
description: Generate technical implementation plan and task list from PRD and ADR documents
argument-hint: [refresh]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(ls:*), Bash(mkdir:*), AskUserQuestion, mcp__context7__resolve-library-id, mcp__context7__query-docs, WebSearch
---

# Plan Management Command

Generate a technical implementation plan and granular task list from existing PRD and ADR documents, preparing a project for incremental AI-assisted development.

## Usage

| Command         | Description                                               |
| --------------- | --------------------------------------------------------- |
| `/plan`         | Generate docs/plan.md and docs/tasks.md from PRD and ADRs |
| `/plan refresh` | Update existing plan/tasks, preserving completed items    |

## Examples

```
/plan           # Initial planning - generate docs/plan.md and docs/tasks.md
/plan refresh   # Update after PRD/ADR changes, keep completed tasks
```

## Workflow

### Initial Run (`/plan`)

1. Read `docs/PRD.md` completely
2. Read all files in `docs/adrs/`
3. **Research library documentation** for all key technologies in the stack:
   - Use `mcp__context7__resolve-library-id` to find library IDs
   - Use `mcp__context7__query-docs` to fetch current best practices and setup guides
   - Use `WebSearch` as fallback for libraries not in Context7
   - Focus on: framework setup, configuration patterns, integration approaches
4. Generate `docs/plan.md` following the plan template (incorporate library best practices)
5. Wait for user approval of plan
6. After approval, generate `docs/tasks.md` following the tasks template
7. Update `CLAUDE.md` with project context
8. Report summary of phases and task count

### Refresh Run (`/plan refresh`)

1. Read current `docs/plan.md` and `docs/tasks.md`
2. Read `docs/PRD.md` and `docs/adrs/` for any updates
3. Preserve completed tasks (checked items)
4. Regenerate incomplete tasks if requirements changed
5. Update `CLAUDE.md` if stack or conventions changed

## Output Files

| File            | Location     | Purpose                                                    |
| --------------- | ------------ | ---------------------------------------------------------- |
| `docs/plan.md`  | docs/ folder | Technical approach bridging requirements to implementation |
| `docs/tasks.md` | docs/ folder | Granular, executable task list with checkboxes             |
| `CLAUDE.md`     | Project root | Persistent context for all Claude Code sessions            |

## Constraints

- Do not write any application code during planning
- Each task must be completable in 10-15 minutes
- Tasks must reference affected files when known
- Phase 0 always covers project scaffolding
- MVP boundary must be explicitly marked

## Key Files

- **Skill definition**: `.claude/skills/plan-management/SKILL.md`
- **Plan template**: `.claude/skills/plan-management/PLAN-TEMPLATE.md`
- **Tasks template**: `.claude/skills/plan-management/TASKS-TEMPLATE.md`
- **CLAUDE.md template**: `.claude/skills/plan-management/CLAUDE-TEMPLATE.md`
