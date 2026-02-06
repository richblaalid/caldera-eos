# Codebase Audit Plan

## Overview

Comprehensive audit of the Ember codebase focusing on file structure best practices, redundancy identification, and dead code cleanup. This plan documents findings and prioritizes improvements.

## Current State Summary

| Metric | Count |
|--------|-------|
| Source files | ~165 |
| Dashboard pages | 28 |
| API route files | 8 |
| React components | 35 |
| Library files | 16 |
| Hidden tool directories | 38+ |

## Findings by Priority

### 🔴 Priority 1: Critical Issues

#### 1.1 Excessive Hidden Directories
**Issue:** 38+ hidden directories for various AI coding assistants (`.claude/`, `.cursor/`, `.windsurf/`, `.cline/`, `.codex/`, `.agents/`, `.augment/`, etc.)

**Risk:**
- Git repository bloat
- Potential credential exposure if tokens stored in these directories
- Noise in project navigation

**Recommendation:**
- Audit each directory for sensitive data
- Add pattern `.*` to `.gitignore` with explicit exceptions for essential directories (`.github/`, `.vscode/`)
- Delete empty or unused tool directories

**Files to check:**
- `.gitignore` - Add comprehensive tool directory exclusions

---

### 🟠 Priority 2: Code Organization

#### 2.1 Monolithic Types File
**File:** [database.ts](ember/src/types/database.ts) (882 lines, 73 exports)

**Issue:** All database types in a single file mixing:
- Database table models (Rocks, Issues, Todos, etc.)
- EOS domain models (VTO structures)
- Integration types (Slack, HubSpot)
- UI helper types (SearchResults)

**Recommendation:** Split by domain:
```
ember/src/types/
├── database.ts          # Generated Supabase types only
├── entities/
│   ├── rocks.ts
│   ├── issues.ts
│   ├── todos.ts
│   ├── scorecard.ts
│   ├── meetings.ts
│   └── transcripts.ts
├── vto.ts              # V/TO related types
├── integrations/
│   ├── slack.ts
│   └── hubspot.ts
├── search.ts           # SearchResults, etc.
└── index.ts            # Re-exports
```

#### 2.2 Large Utility Files Without Clear Separation
| File | Lines | Concern |
|------|-------|---------|
| [eos.ts](ember/src/lib/eos.ts) | 823 | Mixes VTO, Rocks, Issues, Todos, Scorecard, Meetings, Transcripts, Insights operations |
| [ember-tools.ts](ember/src/lib/ember-tools.ts) | 779 | Tool definitions + implementations for Claude |
| [ember.ts](ember/src/lib/ember.ts) | 604 | Mixing AI persona logic with formatting utilities |
| [context.ts](ember/src/lib/context.ts) | 407 | Context building + intent classification + formatting |

**Recommendation for `eos.ts`:** Split into domain modules:
```
ember/src/lib/eos/
├── rocks.ts            # Rock CRUD operations
├── issues.ts           # Issue CRUD operations
├── todos.ts            # Todo CRUD operations
├── scorecard.ts        # Scorecard metric operations
├── meetings.ts         # Meeting operations
├── transcripts.ts      # Transcript operations
├── insights.ts         # Insight operations
├── vto.ts              # VTO operations
├── checkup.ts          # (already exists)
├── utils.ts            # Shared utilities (getUserOrganizationId, etc.)
└── index.ts            # Re-exports all
```

#### 2.3 Large Page Components
| Page | Lines | Extraction Candidates |
|------|-------|----------------------|
| [vto/edit/page.tsx](ember/src/app/dashboard/vto/edit/page.tsx) | 933 | Section components, form validation logic |
| [transcripts/[id]/page.tsx](ember/src/app/dashboard/transcripts/[id]/page.tsx) | 725 | Extraction display, metadata panel |
| [meetings/[id]/page.tsx](ember/src/app/dashboard/meetings/[id]/page.tsx) | 543 | Transcript section, meeting header |

**Recommendation:** Extract subcomponents:
```
ember/src/components/vto/
├── VTOSectionEditor.tsx
├── CoreValuesList.tsx
├── MarketingStrategyForm.tsx
└── ThreeYearPicture.tsx
```

---

### 🟡 Priority 3: Potential Duplication

#### 3.1 Search Functions
**Files:**
- [search.ts](ember/src/lib/search.ts) (222 lines) - Simple ILIKE keyword search
- [hybrid-search.ts](ember/src/lib/hybrid-search.ts) (412 lines) - Keyword + semantic search with RRF

**Analysis:** These serve different purposes:
- `search.ts` → Global search modal (entities: rocks, issues, todos, transcripts, meetings)
- `hybrid-search.ts` → Knowledge retrieval for Ember AI (transcripts + EOS docs)

**Status:** ✅ Not redundant - different use cases
**Recommendation:** Add header comments clarifying the distinct purposes

#### 3.2 Metric Suggestion Files
**Files:**
- [metric-suggestion-utils.ts](ember/src/lib/metric-suggestion-utils.ts) (22 lines) - Client-safe parsing
- [metric-suggestions.ts](ember/src/lib/metric-suggestions.ts) (87 lines) - Server-side generation

**Status:** ✅ Intentional split per commit 6d2ade3 (client-safety boundary)
**Recommendation:** Add documentation explaining the split

---

### 🟢 Priority 4: Minor Improvements

#### 4.1 Missing Public API for `lib/` Module
**Issue:** No centralized `lib/index.ts` - all imports require direct file paths

**Recommendation:** Create `ember/src/lib/index.ts` with explicit exports:
```typescript
// Core operations
export * from './eos'
export { searchAll, type SearchResults } from './search'
export { hybridSearch } from './hybrid-search'

// AI & Chat
export { createEmberResponse } from './ember'
export * from './claude'

// Integrations
export * from './slack'
```

#### 4.2 Type Safety Improvements
**Finding:** 20+ files use `any` type or loose typing

**High-impact files:**
- Dashboard form pages (VTO edit, checkup assess)
- API routes handling JSON fields

**Recommendation:** Add Zod schemas for:
- VTO structure validation
- Scorecard metric validation
- Chat message validation

#### 4.3 ESLint Configuration
**File:** `eslint.config.mjs`

**Current:** Basic Next.js + TypeScript setup
**Recommendation:** Enable stricter rules:
- `noUnusedLocals`
- `noUnusedParameters`
- `noImplicitAny` (after Priority 4.2)

---

## What's Working Well ✅

| Pattern | Status |
|---------|--------|
| Feature-Sliced Design (Frontend) | ✅ Components organized by feature with index exports |
| Clean API Routes | ✅ RESTful routes follow Next.js conventions |
| Database Types | ✅ Well-commented with section headers |
| Separation of Concerns | ✅ Auth, API, Dashboard, Components well-separated |
| Environment Config | ✅ Proper `.env.example` and secure `.env.local` |
| Client Boundary Respect | ✅ "use client" directives properly placed |
| Index Exports | ✅ Present in `components/dashboard/`, `components/ui/` |

---

## Dead Code Analysis

### Confirmed Used Patterns
All `.ts` and `.tsx` files appear actively used based on import analysis.

### Verification Needed
Run these commands to confirm no dead code:

```bash
# Find unused exports
npx ts-prune

# Check for unused dependencies
npx depcheck

# TypeScript strict unused checking
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
```

---

## Implementation Phases

### Phase 1: Repository Cleanup (1 hour)
- [ ] Audit hidden directories for sensitive data
- [ ] Update `.gitignore` to exclude tool directories
- [ ] Remove empty/unused hidden directories
- [ ] Run `git rm -r --cached` for already-tracked tool directories

### Phase 2: Type Organization (2 hours)
- [ ] Create `types/entities/` directory structure
- [ ] Split `database.ts` into domain-specific files
- [ ] Create `types/index.ts` with re-exports
- [ ] Update all imports

### Phase 3: Library Restructure (4 hours)
- [ ] Create `lib/eos/` subdirectory structure
- [ ] Extract `eos.ts` functions into domain modules
- [ ] Create `lib/eos/index.ts` with re-exports
- [ ] Update all imports across codebase
- [ ] Add header documentation to `search.ts` and `hybrid-search.ts`

### Phase 4: Component Extraction (3 hours)
- [ ] Create `components/vto/` with section editors
- [ ] Extract transcript detail subcomponents
- [ ] Extract meeting detail subcomponents
- [ ] Update page imports

### Phase 5: Type Safety (2 hours)
- [ ] Create Zod schemas for VTO structure
- [ ] Create Zod schemas for Scorecard metrics
- [ ] Replace `any` types in high-impact files
- [ ] Update ESLint configuration

### Phase 6: Dead Code Cleanup (1 hour)
- [ ] Run ts-prune and depcheck
- [ ] Remove confirmed unused exports
- [ ] Remove unused dependencies
- [ ] Final TypeScript strict check

---

## Files Affected Summary

### New Files
```
ember/src/types/entities/rocks.ts
ember/src/types/entities/issues.ts
ember/src/types/entities/todos.ts
ember/src/types/entities/scorecard.ts
ember/src/types/entities/meetings.ts
ember/src/types/entities/transcripts.ts
ember/src/types/vto.ts
ember/src/types/integrations/slack.ts
ember/src/types/search.ts
ember/src/types/index.ts
ember/src/lib/eos/rocks.ts
ember/src/lib/eos/issues.ts
ember/src/lib/eos/todos.ts
ember/src/lib/eos/scorecard.ts
ember/src/lib/eos/meetings.ts
ember/src/lib/eos/transcripts.ts
ember/src/lib/eos/insights.ts
ember/src/lib/eos/vto.ts
ember/src/lib/eos/utils.ts
ember/src/lib/eos/index.ts
ember/src/lib/index.ts
ember/src/components/vto/VTOSectionEditor.tsx
ember/src/components/vto/CoreValuesList.tsx
ember/src/components/vto/index.ts
```

### Modified Files
```
.gitignore
ember/src/types/database.ts (shrink/refactor)
ember/src/lib/eos.ts (remove, replaced by modules)
ember/src/lib/search.ts (add documentation)
ember/src/lib/hybrid-search.ts (add documentation)
ember/src/lib/metric-suggestion-utils.ts (add documentation)
ember/eslint.config.mjs
```

---

## Success Criteria

- [ ] No hidden AI tool directories tracked in git (except `.github/`, `.vscode/`)
- [ ] Type files organized by domain (<200 lines each)
- [ ] Library files follow single-responsibility (<300 lines each)
- [ ] All exports documented with JSDoc
- [ ] TypeScript compiles with `--noUnusedLocals` and `--noUnusedParameters`
- [ ] No `any` types in new code
- [ ] All imports use index files where available
