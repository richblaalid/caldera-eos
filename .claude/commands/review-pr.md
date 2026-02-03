---
description: Review PR feedback from Gemini and resolve valid issues
argument-hint: [<pr-number>]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch, Task
---

# Review PR Command

Review a GitHub PR, analyze feedback from Gemini (or other AI reviewers), determine which issues are valid, and resolve them.

## Usage

| Command          | Description                                 |
| ---------------- | ------------------------------------------- |
| `/review-pr`     | Review the most recent PR on current branch |
| `/review-pr 123` | Review specific PR #123                     |

## Examples

```
/review-pr           # Review latest PR
/review-pr 42        # Review PR #42
```

## Workflow

### 1. Identify the PR

If no PR number provided:

```bash
# Try to get PR for current branch first
gh pr view --json number,title,url,headRefName 2>/dev/null || \
# Fall back to most recent PR
gh pr list --limit 1 --json number,title,url,headRefName
```

If PR number provided:

```bash
gh pr view <number> --json number,title,url,headRefName,body
```

### 2. Fetch PR Comments and Reviews

```bash
# Get all review comments
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments --jq '.[] | {path: .path, line: .line, body: .body, user: .user.login}'

# Get all PR reviews with their comments
gh api repos/{owner}/{repo}/pulls/{pr_number}/reviews --jq '.[] | {user: .user.login, state: .state, body: .body}'

# Get issue-level comments (not inline)
gh api repos/{owner}/{repo}/issues/{pr_number}/comments --jq '.[] | {user: .user.login, body: .body}'
```

### 3. Identify Gemini Feedback

Look for comments from:

- Users with "gemini" in their name (case-insensitive)
- Users with "google" in their name
- Bot accounts that may be Gemini-based
- Comments that appear to be AI-generated code review feedback

### 4. Analyze Each Issue

For each piece of feedback identified:

1. **Read the relevant file(s)** mentioned in the feedback
2. **Understand the context** - what is the code doing?
3. **Evaluate the feedback**:
   - Is this a real bug or issue?
   - Is this a valid style/convention concern?
   - Is this a false positive or misunderstanding?
   - Does this conflict with project conventions in CLAUDE.md?

### 5. Categorize Findings

Create a summary table:

```
| Issue | File:Line | Feedback Summary | Valid? | Action |
|-------|-----------|------------------|--------|--------|
| 1     | src/x.ts:42 | Unused variable | Yes | Fix |
| 2     | src/y.ts:10 | Missing null check | No | Ignore - handled by TS strict |
| 3     | src/z.ts:5 | Naming convention | Yes | Fix |
```

### 6. Resolve Valid Issues

For each valid issue:

1. Make the fix
2. Run `npm run typecheck` and `npm run test` to verify
3. Note what was fixed

For invalid issues:

- Document why it's not a real issue
- Optionally reply to the comment explaining (ask user first)

### 7. Commit and Push

If fixes were made:

```bash
git add -A
git commit -m "fix: address PR review feedback

- {list of fixes made}

Co-Authored-By: Claude <noreply@anthropic.com>"

git push
```

## Reporting

### Initial Analysis

```
Reviewing PR #{number}: {title}
URL: {url}
Branch: {branch}

Found {N} comments from Gemini/AI reviewers:
{list of feedback items}

Analyzing each issue...
```

### After Analysis

```
PR Review Analysis Complete
===========================

Valid Issues ({count}):
{numbered list with file:line and summary}

Invalid/False Positives ({count}):
{numbered list with reasoning}

Proceeding to fix valid issues...
```

### After Fixes

```
PR Review Complete
==================

Fixed {N} issues:
- {file}: {description of fix}
- ...

Ignored {M} false positives:
- {file}: {reason}
- ...

Changes committed and pushed.
Commit: {short hash}
```

## Handling Edge Cases

### No PR Found

```
No PR found for current branch.
Use `/review-pr <number>` to specify a PR number.
```

### No Gemini Feedback

```
No Gemini/AI reviewer feedback found on PR #{number}.
Other comments found: {count}
Would you like me to review all comments instead?
```

### All Issues Invalid

```
Analyzed {N} issues from Gemini feedback.
All appear to be false positives or non-issues:
{list with reasoning}

No changes needed.
```

## Key Commands Reference

```bash
# Get PR details
gh pr view {number} --json number,title,url,body,headRefName

# Get review comments (inline)
gh api repos/{owner}/{repo}/pulls/{number}/comments

# Get PR reviews
gh api repos/{owner}/{repo}/pulls/{number}/reviews

# Get issue comments
gh api repos/{owner}/{repo}/issues/{number}/comments

# Get changed files
gh pr view {number} --json files --jq '.files[].path'
```
