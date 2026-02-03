# Plan Management Cheatsheet

## Quick Reference

### Task Numbering
```
{phase}.{group}.{task}
0.1.1 → Phase 0, Group 1, Task 1
```

### Task Size
- 10-15 minutes each
- One clear outcome
- Single file or concept focus

### Phase Structure
```
Phase 0: Foundation (always first)
Phase 1-N: Features
--- MVP Boundary ---
Phase N+1: Post-MVP
```

---

## Command Quick Reference

| Command | Action |
|---------|--------|
| `/plan` | Generate plan.md and tasks.md |
| `/plan refresh` | Update plan, preserve completed |
| `/execute` | Run next incomplete task |
| `/execute phase` | Complete current phase |
| `/execute 1.2.3` | Run specific task |

---

## File Locations

| File | Location |
|------|----------|
| Plan | `docs/plan.md` |
| Tasks | `docs/tasks.md` |
| PRD | `docs/prds/*.md` |
| ADRs | `docs/adrs/*.md` |
| Context | `CLAUDE.md` |

---

## Task Checklist

Before marking complete:
- [ ] Code implemented
- [ ] Tests pass (`npm run test`)
- [ ] Types check (`npm run typecheck`)
- [ ] Lint passes (`npm run lint`)
- [ ] Task marked `[x]` in tasks.md
- [ ] Task Log updated
- [ ] Changes committed
- [ ] Changes pushed

---

## Common Patterns

### Good Task
```markdown
- [ ] **1.2.3** Create RockCard component with status badge
  - Files: `components/RockCard.tsx`
  - Notes: Accept Rock type, show owner avatar
```

### Good Checkpoint
```markdown
**Checkpoint:** All rocks display on dashboard, status updates persist
```

### Good Phase Goal
```markdown
**Goal:** Users can view, create, and update quarterly rocks
```
