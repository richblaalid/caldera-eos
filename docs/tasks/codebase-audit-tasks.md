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

### 2.1 Create Type Directory Structure
- [ ] Create `ember/src/types/entities/` directory
- [ ] Create `ember/src/types/integrations/` directory

### 2.2 Extract Entity Types
- [ ] Extract Rock-related types from `database.ts` → `entities/rocks.ts`
- [ ] Extract Issue-related types from `database.ts` → `entities/issues.ts`
- [ ] Extract Todo-related types from `database.ts` → `entities/todos.ts`
- [ ] Extract Scorecard types from `database.ts` → `entities/scorecard.ts`
- [ ] Extract Meeting types from `database.ts` → `entities/meetings.ts`
- [ ] Extract Transcript types from `database.ts` → `entities/transcripts.ts`

### 2.3 Extract Domain Types
- [ ] Extract VTO types from `database.ts` → `types/vto.ts`
- [ ] Extract Search types from `database.ts` → `types/search.ts`
- [ ] Extract Slack types from `database.ts` → `integrations/slack.ts`
- [ ] Extract Checkup types from `database.ts` → `entities/checkup.ts`

### 2.4 Create Type Index
- [ ] Create `types/entities/index.ts` with re-exports
- [ ] Create `types/integrations/index.ts` with re-exports
- [ ] Update `types/index.ts` to re-export all domains
- [ ] Update all imports in codebase to use new paths

---

## Phase 3: Library Restructure

### 3.1 Create EOS Module Structure
- [ ] Create `ember/src/lib/eos/` directory (if adding to existing `checkup.ts`)
- [ ] Create `ember/src/lib/eos/utils.ts` with shared utilities (`getUserOrganizationId`, etc.)

### 3.2 Extract EOS Domain Modules
- [ ] Extract Rock operations from `eos.ts` → `eos/rocks.ts`
- [ ] Extract Issue operations from `eos.ts` → `eos/issues.ts`
- [ ] Extract Todo operations from `eos.ts` → `eos/todos.ts`
- [ ] Extract Scorecard operations from `eos.ts` → `eos/scorecard.ts`
- [ ] Extract Meeting operations from `eos.ts` → `eos/meetings.ts`
- [ ] Extract Transcript operations from `eos.ts` → `eos/transcripts.ts`
- [ ] Extract Insight operations from `eos.ts` → `eos/insights.ts`
- [ ] Extract VTO operations from `eos.ts` → `eos/vto.ts`

### 3.3 Create EOS Module Index
- [ ] Create `lib/eos/index.ts` with re-exports from all domain modules
- [ ] Update all imports in API routes to use new module paths
- [ ] Update all imports in pages to use new module paths
- [ ] Verify no circular dependencies

### 3.4 Add Documentation Headers
- [ ] Add JSDoc header to `lib/search.ts` explaining: "Global entity search (SearchModal)"
- [ ] Add JSDoc header to `lib/hybrid-search.ts` explaining: "Semantic + keyword search for AI retrieval"
- [ ] Add JSDoc header to `lib/metric-suggestion-utils.ts` explaining client-safety split

### 3.5 Create Library Index
- [ ] Create `lib/index.ts` with explicit public API exports
- [ ] Document which exports are public vs internal

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
