---
description: Investigate and fix bugs systematically
argument-hint: "[bug description]" to start investigation
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm:*, git:log*, git:diff*, git:show*), AskUserQuestion, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# /bugfix - Structured Bug Investigation and Fix

Use this command to investigate and fix bugs systematically.

## Arguments

- `/bugfix [bug description]` - Start investigating a bug
- `/bugfix` - Continue investigating an existing bug from plans/

## Instructions

You are starting a structured bug fix workflow. Your goal is to understand the root cause before writing any fix.

### Step 1: Understand the Bug

Ask clarifying questions using AskUserQuestion:

1. **Reproduction**: Can you reproduce it? What are the exact steps?
2. **Expected vs Actual**: What should happen? What happens instead?
3. **Scope**: Is this affecting all users or specific scenarios?
4. **Urgency**: Is this blocking production? What's the severity?

### Step 2: Investigate

Use the Explore agent to:
- Find the code path that's failing
- Identify the root cause (not just symptoms)
- Check for related issues in similar code
- Review recent changes that might have introduced the bug

Use git to check recent changes:
```bash
git log --oneline -20
git diff HEAD~5..HEAD -- path/to/affected/file.ts
```

### Step 3: Research (if needed)

If the bug involves library behavior, use Context7 to check documentation:
```
mcp__context7__resolve-library-id → mcp__context7__query-docs
```

### Step 4: Document the Bug

Create a bug document in `docs/plans/bugfix-[brief-name].md` using BUG-TEMPLATE.md:

1. **Problem**: Clear description with reproduction steps
2. **Root Cause**: Why this is happening (with code references)
3. **Fix Approach**: How you'll fix it
4. **Risk Assessment**: Could the fix break anything else?

### Step 5: Confirm Approach

Before implementing, confirm with the user:
- Your understanding of the root cause
- The proposed fix approach
- Any risks or tradeoffs

### Step 6: Fix and Verify

After approval:
1. Write a failing test that reproduces the bug (if possible)
2. Implement the minimal fix
3. Verify the test passes
4. Check for regressions in related functionality
5. Run the full test suite: `npm test`
6. Run the build: `npm run build`

## Quality Gates

- [ ] Bug clearly understood and reproducible
- [ ] Root cause identified (not just symptoms)
- [ ] Fix approach documented in docs/plans/bugfix-*.md
- [ ] User confirmed the approach
- [ ] Test written for the bug (when possible)
- [ ] Fix implemented and verified
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] No regressions introduced

## Example Usage

```
/bugfix Payment amounts showing negative instead of positive
/bugfix Login redirect not working after session timeout
/bugfix Billing calculation off by one month
```
