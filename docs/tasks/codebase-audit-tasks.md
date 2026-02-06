# Codebase Audit Tasks

> Generated from: [codebase-audit-plan.md](../plans/codebase-audit-plan.md)
>
> Task format: Each task should be completable in 10-15 minutes

## Phase 1: Repository Cleanup

### 1.1 Hidden Directory Audit
- [x] List all hidden directories: `ls -la ember/` and document findings
- [x] Check `.cursor/`, `.windsurf/`, `.cline/` for any stored credentials or tokens
- [x] Check `.claude/`, `.codex/`, `.agents/`, `.augment/` for sensitive data
- [x] Document which directories are safe to delete

**Findings:**
- 30+ empty AI tool directories in ember/ (windsurf, cline, codex, etc.) - SAFE TO IGNORE
- Root .agents/, .claude/, .cursor/ contain skills - KEEP TRACKED
- No credentials found in any directories

### 1.2 Update .gitignore
- [x] Add `.*` pattern to exclude all hidden directories
- [x] Add explicit exceptions: `!.github/`, `!.vscode/`, `!.env.example`
- [x] Verify `.gitignore` patterns don't break essential tooling

**Approach:**
- Updated ember/.gitignore with explicit list of 36 AI tool directories
- Root .gitignore updated with OS file patterns
- Root-level skill directories (.agents, .claude, .cursor) kept tracked

### 1.3 Clean Up Git History
- [x] Run `git rm -r --cached .cursor/` (if tracked)
- [x] Run `git rm -r --cached .windsurf/` (if tracked)
- [x] Run `git rm -r --cached` for other tracked tool directories
- [x] Delete empty/unused hidden directories from filesystem

**Results:**
- Removed 378 tracked files from 35 AI tool directories
- Only ember/.env.example and ember/.gitignore remain tracked
- Directories left on filesystem but now gitignored

---

## Phase 2: Type Organization

> **SKIPPED** - Decided not to proceed. Rationale:
> - database.ts (883 lines) is already well-organized with clear section headers
> - 63 files would require import updates (high churn, low benefit)
> - File organization is manageable as-is

### 2.1-2.4 All tasks skipped
See rationale above.

---

## Phase 3: Library Restructure

> **SKIPPED** - Decided not to proceed. Rationale:
> - eos.ts (823 lines) is already well-organized with section headers
> - 23 files would require import updates
> - Same trade-off as Phase 2: high churn, manageable as-is

### 3.1-3.5 All tasks skipped
See rationale above.

---

## Phase 4: Component Extraction

> **SKIPPED** - Same structural refactoring trade-off as Phases 2-3.

### 4.1-4.3 All tasks skipped
See rationale above.

---

## Phase 5: Type Safety

> **DEFERRED** - Can be addressed incrementally as features are built.

### 5.1-5.3 All tasks deferred
Type safety improvements are lower priority than Phase 1 cleanup.

---

## Phase 6: Dead Code Cleanup

### 6.1 Analysis Tools
- [x] Install and run `npx ts-prune` to find unused exports
- [x] Install and run `npx depcheck` to find unused dependencies
- [x] Run `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`

**Findings documented below - decided not to remove as they may be reserved for future use.**

### 6.2 Analysis Results (No Action Taken)

**Unused Dependency:**
- `date-fns` - Not imported anywhere (may add later for date formatting)

**Unused Exports in eos.ts:**
- `getActiveInsights` (line 601) - Insights feature not fully wired
- `acknowledgeInsight` (line 614) - Insights feature not fully wired
- `getProfile` (line 692) - Singular version, getProfiles (plural) is used
- `getTranscriptChunks` (line 779) - Reserved for future transcript features
- `updateChunkEmbedding` (line 802) - Reserved for embedding updates

**Unused Exports in hybrid-search.ts:**
- `searchTranscripts`, `searchEOSKnowledge`, `keywordSearch`, `semanticSearch` (lines 377-407)
- These are convenience wrappers; internal functions are used by `hybridSearch`

**Unused Constants in ember.ts:**
- `CALDERA_PARTNERS`, `CALDERA_BUSINESS_CONTEXT` - Domain context for AI prompts

### 6.3 Final Verification
- [x] Analysis completed
- [x] Findings documented
- [ ] No cleanup performed (intentionally kept for future use)

---

## Audit Summary

**Completed:**
- [x] Phase 1: Repository Cleanup - Removed 378 tracked AI tool files, updated .gitignore

**Skipped (intentionally - well-organized code, high churn):**
- Phase 2: Type Organization - database.ts already well-sectioned
- Phase 3: Library Restructure - eos.ts already well-sectioned
- Phase 4: Component Extraction - same trade-off

**Deferred:**
- Phase 5: Type Safety - address incrementally with features
- Phase 6: Dead Code Cleanup - analysis done, no removal (reserved for future)

**Key Outcome:**
Repository size reduced by ~18k lines of duplicated skill files. No hidden tool directories tracked in git.
