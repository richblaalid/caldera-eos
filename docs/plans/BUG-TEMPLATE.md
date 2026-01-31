# Bug Investigation Template

Use this template for bug investigation documents in `docs/plans/`.

**Filename:** `bugfix-{brief-name}.md`

---

```markdown
# Bugfix: {Brief Bug Name}

**Status:** {Investigating | Root Cause Found | Fix In Progress | Resolved}
**Date:** {YYYY-MM-DD}
**Reported By:** {Name or source}
**Severity:** {Critical | High | Medium | Low}

---

## Problem

### Description
{Clear description of the bug}

### Expected Behavior
{What should happen}

### Actual Behavior
{What actually happens}

### Reproduction Steps
1. {Step 1}
2. {Step 2}
3. {Step 3}

### Environment
- Browser/Client: {if applicable}
- User: {if applicable}
- Frequency: {Always | Sometimes | Rarely}

---

## Investigation

### Initial Findings
{What you discovered during investigation}

### Code Path
{Trace the execution path that leads to the bug}

```
{file}:{line} → {function}
  ↓
{file}:{line} → {function}
  ↓
{BUG HERE}
```

### Related Code
{Links to relevant code sections}

- `{file}:{line}` - {description}
- `{file}:{line}` - {description}

---

## Root Cause

### Summary
{One sentence explanation of why this bug occurs}

### Technical Details
{Detailed explanation of the root cause}

### How It Was Introduced
{If known: commit, PR, or change that introduced this}

---

## Fix Approach

### Proposed Solution
{Description of how to fix the bug}

### Changes Required
| File | Change |
|------|--------|
| `{file}` | {what to change} |

### Alternative Approaches Considered
{Other options and why they weren't chosen}

---

## Risk Assessment

### Could This Fix Break Other Things?
{Analysis of potential regressions}

### Testing Strategy
- [ ] {Test case 1}
- [ ] {Test case 2}
- [ ] {Regression test}

---

## Resolution

### Fix Implemented
{Description of the actual fix applied}

### Commit
{Commit hash or PR link}

### Verified By
- [ ] Bug no longer reproduces
- [ ] Tests pass
- [ ] No regressions found
```
