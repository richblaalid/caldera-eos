---
description: Run all quality checks before committing or creating PRs
argument-hint: [full|quick|fix]
allowed-tools: Read, Glob, Grep, Bash, Task, AskUserQuestion
---

# Quality Gate Command

Run comprehensive quality checks before committing code or creating pull requests. This command enforces the project's quality standards and catches issues early.

## Usage

| Command | Description |
|---------|-------------|
| `/quality-gate` | Run full quality checks (default) |
| `/quality-gate quick` | Run fast checks only (typecheck + lint) |
| `/quality-gate fix` | Run checks and auto-fix what's possible |
| `/quality-gate pre-commit` | Checks suitable for pre-commit hook |

## Examples

```
/quality-gate           # Full check before PR
/quality-gate quick     # Fast check during development
/quality-gate fix       # Auto-fix lint and format issues
```

## Quality Checks

### Level 1: Fast Checks (Always Run)

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| TypeScript | `npm run typecheck` | Zero errors |
| ESLint | `npm run lint` | Zero errors (warnings OK) |

### Level 2: Test Suite (Full Mode)

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| Unit Tests | `npm run test` | All tests pass |
| Coverage | (if configured) | Meets threshold |

### Level 3: Build Verification (Full Mode)

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| Production Build | `npm run build` | Builds successfully |
| Bundle Size | (if configured) | Under limit |

### Level 4: Code Quality (Full Mode)

| Check | Tool | Pass Criteria |
|-------|------|---------------|
| Code Review | `superpowers:requesting-code-review` | Major issues addressed |
| Security | Manual review | No secrets committed |

## Workflow

### Quick Mode (`/quality-gate quick`)

```bash
# Run in parallel
npm run typecheck &
npm run lint &
wait
```

Report format:
```
Quick Quality Gate
==================
✓ TypeScript: No errors
✓ ESLint: No errors (3 warnings)

Ready for commit: YES
```

### Full Mode (`/quality-gate` or `/quality-gate full`)

1. **Run Level 1 checks**
   ```bash
   npm run typecheck
   npm run lint
   ```

2. **Run Level 2 checks**
   ```bash
   npm run test
   ```

3. **Run Level 3 checks**
   ```bash
   npm run build
   ```

4. **Code Review** (if significant changes)
   - Invoke `superpowers:requesting-code-review` for major changes
   - Or use `feature-dev:code-reviewer` agent

5. **Security Check**
   - Scan for `.env` files in staged changes
   - Check for hardcoded secrets patterns

Report format:
```
Full Quality Gate
=================
Level 1: Static Analysis
  ✓ TypeScript: No errors
  ✓ ESLint: No errors

Level 2: Tests
  ✓ Unit Tests: 42 passed
  ✓ Coverage: 78% (threshold: 70%)

Level 3: Build
  ✓ Production Build: Success
  ✓ Bundle Size: 245KB (limit: 500KB)

Level 4: Review
  ✓ No secrets detected
  ⚠ Code review recommended (15 files changed)

Ready for PR: YES
Recommendation: Request code review before merge
```

### Fix Mode (`/quality-gate fix`)

1. Run `npm run lint -- --fix` to auto-fix lint issues
2. Run typecheck to identify remaining issues
3. Report what was fixed vs what needs manual attention

```
Quality Gate Fix
================
Auto-fixed:
  - 3 import order issues
  - 2 unused import removals
  - 1 trailing comma

Manual fixes needed:
  - src/lib/eos.ts:42 - Type error: Property 'x' does not exist
  - src/components/Card.tsx:15 - ESLint: Unexpected any

Run `/quality-gate` after manual fixes
```

## Pre-Commit Integration

For `pre-commit` mode, output is optimized for git hooks:

```bash
# In .husky/pre-commit (if using husky)
npx claude-code /quality-gate pre-commit || exit 1
```

Pre-commit runs:
- TypeScript check
- Lint (staged files only ideally)
- Exits with code 1 if failures

## Failure Handling

### TypeScript Errors
```
TypeScript Check Failed
=======================
Found 3 errors:

1. src/lib/eos.ts:42:5
   error TS2339: Property 'foo' does not exist on type 'Bar'

2. src/components/Modal.tsx:15:10
   error TS7006: Parameter 'e' implicitly has an 'any' type

Fix these errors before proceeding.
```

### Test Failures
```
Test Suite Failed
=================
2 tests failed:

FAIL src/lib/eos.test.ts
  ✕ createRock should validate owner (45ms)
  ✕ updateRock should check permissions (23ms)

Run `npm run test -- --watch` to debug.
```

### Build Failures
```
Build Failed
============
Error: Module not found: Can't resolve './missing-file'

This usually means:
- A file was deleted but still imported
- A path is incorrect
- A dependency is missing

Check the import paths and try again.
```

## Integration with Development Workflow

### When to Use Each Mode

| Situation | Command |
|-----------|---------|
| Quick check while coding | `/quality-gate quick` |
| Before committing | `/quality-gate` |
| Before creating PR | `/quality-gate full` |
| After lint warnings | `/quality-gate fix` |
| CI/CD pipeline | `/quality-gate pre-commit` |

### Recommended Workflow

1. **During development**: Run `/quality-gate quick` frequently
2. **Before commit**: Run `/quality-gate`
3. **Before PR**: Run `/quality-gate full` + code review
4. **After PR feedback**: Fix issues, run `/quality-gate` again

## Global Skills Integration

This command works well with:
- `superpowers:verification-before-completion` - Ensures evidence before claims
- `superpowers:requesting-code-review` - For thorough review
- `superpowers:finishing-a-development-branch` - Full completion workflow
