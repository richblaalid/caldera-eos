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

### 4.1 VTO Components
- [ ] Create `components/vto/` directory
- [ ] Extract Core Values list component from `vto/edit/page.tsx`
- [ ] Extract Marketing Strategy section from `vto/edit/page.tsx`
- [ ] Extract Three Year Picture section from `vto/edit/page.tsx`
- [ ] Extract One Year Plan section from `vto/edit/page.tsx`
- [ ] Create `components/vto/index.ts` with exports

### 4.2 Transcript Components
- [ ] Create `components/transcripts/` directory (if not exists)
- [ ] Extract extraction display component from `transcripts/[id]/page.tsx`
- [ ] Extract metadata panel component from `transcripts/[id]/page.tsx`
- [ ] Create `components/transcripts/index.ts` with exports

### 4.3 Meeting Components
- [ ] Create `components/meetings/` directory (if not exists)
- [ ] Extract transcript section from `meetings/[id]/page.tsx`
- [ ] Extract meeting header component from `meetings/[id]/page.tsx`
- [ ] Create `components/meetings/index.ts` with exports

---

## Phase 5: Type Safety

### 5.1 Add Zod Schemas
- [ ] Create `lib/validation/vto.ts` with VTO Zod schema
- [ ] Create `lib/validation/scorecard.ts` with Scorecard metric Zod schema
- [ ] Create `lib/validation/chat.ts` with chat message Zod schema
- [ ] Create `lib/validation/index.ts` with exports

### 5.2 Replace Any Types
- [ ] Fix `any` types in `dashboard/checkup/assess/page.tsx`
- [ ] Fix `any` types in `dashboard/vto/page.tsx`
- [ ] Fix `any` types in `dashboard/vto/edit/page.tsx`
- [ ] Fix `any` types in API routes handling JSON fields

### 5.3 ESLint Configuration
- [ ] Update `eslint.config.mjs` to enable `noUnusedLocals`
- [ ] Update `eslint.config.mjs` to enable `noUnusedParameters`
- [ ] Run `npm run lint` and fix reported issues

---

## Phase 6: Dead Code Cleanup

### 6.1 Analysis Tools
- [ ] Install and run `npx ts-prune` to find unused exports
- [ ] Install and run `npx depcheck` to find unused dependencies
- [ ] Run `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`

### 6.2 Cleanup Actions
- [ ] Remove unused exports identified by ts-prune
- [ ] Remove unused dependencies from `package.json`
- [ ] Fix any remaining TypeScript errors from strict checks

### 6.3 Final Verification
- [ ] Run `npm run build` to verify no build errors
- [ ] Run `npm run typecheck` to verify type safety
- [ ] Run `npm run lint` to verify linting passes
- [ ] Commit all cleanup changes

---

## Verification Checklist

After completing all phases:

- [ ] `npm run build` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] No hidden tool directories tracked in git (verify with `git status`)
- [ ] Type files are <200 lines each
- [ ] Library domain modules are <300 lines each
- [ ] All imports use index files where available
- [ ] No new `any` types introduced
