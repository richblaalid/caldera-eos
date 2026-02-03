---
description: Execute tasks from docs/tasks.md with full protocol compliance
argument-hint: [<task-id>|phase|to <task-id>]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, mcp__context7__resolve-library-id, mcp__context7__query-docs, WebSearch
---

# Execute Command

Execute the next incomplete task from docs/tasks.md with full protocol compliance.

## Usage

| Command             | Description                              |
| ------------------- | ---------------------------------------- |
| `/execute`          | Run the next single incomplete task      |
| `/execute phase`    | Run all remaining tasks in current phase |
| `/execute to 1.2.3` | Run tasks up to and including task 1.2.3 |
| `/execute 1.2.3`    | Run specific task 1.2.3                  |

## Examples

```
/execute              # Do next task
/execute phase        # Complete current phase
/execute to 0.3.1     # Run tasks through 0.3.1
/execute 1.1.1        # Run specific task 1.1.1
```

## Workflow

### Pre-Work: Branch Setup (REQUIRED)

Before starting ANY task, check and set up the working branch:

1. **Check current branch**: Run `git branch --show-current`
2. **If on `main` or `master`**:
   - Create a new feature branch: `git checkout -b task/{first-task-id}-{short-description}`
   - Example: `git checkout -b task/1.2.1-add-login-form`
   - The branch name should reflect the first task being worked on
3. **If already on a feature branch**: Continue using it
4. **Report branch status**: State which branch you're working on

### For Single Task (`/execute` or `/execute <task-id>`)

1. Read `CLAUDE.md` for project context and conventions
2. Read `docs/tasks.md` to find target task
3. **Run branch setup** (see Pre-Work above)
4. State intent: "Working on task {N.N.N}: {description}"
5. Pause briefly for potential interrupt
6. **Research library documentation** before implementing:
   - Identify libraries/frameworks involved in this task
   - Use `mcp__context7__resolve-library-id` to find library IDs
   - Use `mcp__context7__query-docs` to fetch relevant API docs and examples
   - Use `WebSearch` as fallback for libraries not in Context7
   - Focus on: specific APIs needed, current syntax, recommended patterns
7. Implement the task following conventions and researched best practices
8. Run `npm run test` and `npm run typecheck`
9. If tests fail, fix before proceeding
10. Mark task complete in docs/tasks.md
11. Update Task Log with date
12. Commit with message: `type(scope): description (task-id)`
13. Push to remote: `git push -u origin {branch-name}`
14. Report completion summary
15. **Ask user**: "Continue to next task or create PR from current work?"
    - If **continue**: Proceed to next task
    - If **create PR**: Run PR creation workflow (see Post-Work below)

### For Phase (`/execute phase`)

1. Read `CLAUDE.md` and `docs/tasks.md`
2. **Run branch setup** (see Pre-Work above)
3. Identify all incomplete tasks in current phase
4. For each task:
   - State intent
   - **Research library documentation** (same as single task workflow step 6)
   - Implement
   - Test
   - Mark complete
   - Commit
   - Push to remote
5. Stop at phase checkpoint
6. Verify all checkpoint criteria
7. Report phase completion summary
8. **Ask user**: "Create PR for this phase or continue to next phase?"

### For Range (`/execute to <task-id>`)

1. Read `CLAUDE.md` and `docs/tasks.md`
2. **Run branch setup** (see Pre-Work above)
3. Identify tasks from current to target
4. Execute each task sequentially (same as single task flow, including documentation research)
5. Push all commits to remote
6. Stop after target task
7. Report summary
8. **Ask user**: "Continue to next task or create PR from current work?"

### Post-Work: PR Creation

When user requests PR creation, use GitHub CLI:

```bash
gh pr create --title "type(scope): description" --body "$(cat <<'EOF'
## Summary
- Task {N.N.N}: {description}
- Task {N.N.M}: {description}
...

## Changes
- {bullet points of key changes}

## Testing
- [ ] All tests pass (`npm run test`)
- [ ] TypeScript checks pass (`npm run typecheck`)
- [ ] Lint checks pass (`npm run lint`)

---
🤖 Generated with Claude Code
EOF
)"
```

**PR Title Format**: Same as commit message - `type(scope): description`

**After PR creation**:

1. Report the PR URL to the user
2. Ask: "PR created! Switch back to main, or continue on this branch?"
   - If **switch to main**: `git checkout main && git pull`
   - If **continue**: Stay on current branch for additional work

## Safeguards

- **Never proceed past a phase checkpoint without explicit approval**
- **Stop immediately on any test failure** - fix before continuing
- **Stop immediately on any TypeScript error** - fix before continuing
- **Maximum 5 tasks per `/execute phase`** - prevents runaway execution
- **Always commit after each successful task**
- **Never work directly on main/master** - always create a feature branch first
- **Always push after commits** - keeps remote in sync
- **Never force push** - use regular push only

## Task Completion Criteria

A task is complete when:

1. Code changes are implemented
2. Code has been reviewed and simplified by code-simplifier agent
3. `npm run test` passes (all tests)
4. `npm run typecheck` passes (no TS errors)
5. `npm run lint` passes (no lint errors)
6. Task checkbox is marked `[x]` in docs/tasks.md
7. Task Log is updated
8. Changes are committed
9. Changes are pushed to remote

## Handling Failures

### Test Failure

```
Test failed for task {N.N.N}.
Error: {error details}

Attempting fix...
{Fix attempt}

Re-running tests...
{Result}
```

If fix succeeds, continue. If not, stop and report.

### TypeScript Error

```
TypeScript error in task {N.N.N}.
Error: {error details}

Fixing type error...
{Fix}

Re-running typecheck...
{Result}
```

### Blocked Task

```
Task {N.N.N} is blocked.
Reason: {from task notes}

Skipping to next unblocked task...
```

Or stop if no unblocked tasks remain.

## Commit Message Format

```
type(scope): description (task-id)

- Detail 1
- Detail 2

Co-Authored-By: Claude <noreply@anthropic.com>
```

Types:

- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code restructuring
- `test` - Adding tests
- `docs` - Documentation
- `chore` - Maintenance

## Reporting

After each task:

```
✓ Task {N.N.N} complete: {description}
  Branch: {branch-name}
  Files: {changed files}
  Tests: {pass count} passing
  Commit: {short hash}
  Pushed: ✓

Continue to next task or create PR?
```

After phase:

```
Phase {N} complete!
  Branch: {branch-name}
  Tasks: {completed}/{total}
  Commits: {count}
  All pushed: ✓

Checkpoint verification:
  ✓ {criterion 1}
  ✓ {criterion 2}

Create PR for this phase or continue to next phase?
```

After PR creation:

```
✓ PR created: {PR-URL}
  Title: {pr-title}
  Branch: {branch-name} → main

Switch back to main or continue on this branch?
```

## Session Handoff

If stopping mid-phase:

```
Session paused at task {N.N.N}.

Progress:
  Branch: {branch-name}
  Phase {N}: {X}/{Y} tasks complete
  All changes pushed: ✓

Next task: {N.N.M}: {description}

To resume: `/execute` or `/execute to {target}`
To create PR now: Ask "create PR"
```

## Key Files

| File            | Purpose                                 |
| --------------- | --------------------------------------- |
| `CLAUDE.md`     | Project context and conventions         |
| `docs/tasks.md` | Task list with checkboxes               |
| `docs/plan.md`  | Phase context and verification criteria |
