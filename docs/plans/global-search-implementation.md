# Global Search Implementation Plan

## Overview

Implement a functional global search feature that allows users to search across all EOS data (rocks, issues, todos, transcripts, meetings) from the existing header search input.

## Current State

- Search input exists in `Header.tsx` but is non-functional (placeholder)
- No search API endpoint exists
- No full-text search indexes configured
- pgvector is enabled for transcript embeddings but not used for search

## Design Decisions

### Approach: PostgreSQL ILIKE with Debounced Queries

**Rationale:**
- Quick to implement with existing Supabase patterns
- Sufficient for current data volume (small team, limited records)
- No additional infrastructure required
- Can upgrade to FTS indexes later if performance becomes an issue

**Alternative considered:** PostgreSQL full-text search (tsvector/GIN indexes)
- Overkill for current data volume
- Can migrate to this later without frontend changes

### Search Result Structure

```typescript
interface SearchResults {
  rocks: RockWithOwner[]
  issues: IssueWithOwner[]
  todos: TodoWithOwner[]
  transcripts: Transcript[]
  meetings: Meeting[]
}
```

### UX Pattern: Command Palette Style

- Keyboard shortcut: `Cmd+K` (Mac) / `Ctrl+K` (Windows)
- Modal overlay with categorized results
- Navigate with arrow keys, Enter to select
- Escape to close

## Technical Design

### API Endpoint

```
GET /api/eos/search?q=<query>&types=rocks,issues,todos
```

**Parameters:**
- `q` (required): Search query string (min 2 chars)
- `types` (optional): Comma-separated entity types to search (default: all)

**Response:**
```json
{
  "rocks": [...],
  "issues": [...],
  "todos": [...],
  "transcripts": [...],
  "meetings": []
}
```

### Search Logic per Entity

| Entity | Fields Searched | Sort |
|--------|-----------------|------|
| Rocks | title, description, notes | updated_at desc |
| Issues | title, description, resolution | created_at desc |
| Todos | title, description | due_date asc, created_at desc |
| Transcripts | title, summary | meeting_date desc |
| Meetings | title, notes | meeting_date desc |

### Frontend Components

```
Header.tsx
  └── SearchModal.tsx (new)
        ├── SearchInput (focused, keyboard handling)
        ├── SearchResults
        │     ├── RocksSection
        │     ├── IssuesSection
        │     ├── TodosSection
        │     ├── TranscriptsSection
        │     └── MeetingsSection
        └── KeyboardHints
```

## Files to Create

| File | Purpose |
|------|---------|
| `ember/src/lib/search.ts` | Search functions with Supabase queries |
| `ember/src/app/api/eos/search/route.ts` | Search API endpoint |
| `ember/src/components/dashboard/SearchModal.tsx` | Search modal UI |
| `ember/src/hooks/useSearch.ts` | Search state + debouncing hook |

## Files to Modify

| File | Changes |
|------|---------|
| `ember/src/components/dashboard/Header.tsx` | Wire up search input to open modal |
| `ember/src/types/database.ts` | Add SearchResults type |

## Implementation Phases

### Phase 1: Backend Search API
- Create `/lib/search.ts` with search functions
- Create `/api/eos/search/route.ts` endpoint
- Add SearchResults type

### Phase 2: Search Modal UI
- Create SearchModal component with result sections
- Style with existing design system
- Add keyboard navigation

### Phase 3: Integration
- Wire Header search input to open modal
- Add Cmd+K global shortcut
- Add result click navigation
- Add debounced input handling

### Phase 4: Polish
- Add loading states
- Add empty state messaging
- Add keyboard hints
- Test across entity types

## Task Breakdown

### Phase 1: Backend (3 tasks)

- [ ] **1.1** Create `/lib/search.ts` with `globalSearch()` function
  - Accept query string and optional entity types filter
  - Query each entity type with ILIKE on searchable fields
  - Return unified SearchResults object
  - Limit results per type (5-10 items)

- [ ] **1.2** Create `/api/eos/search/route.ts` endpoint
  - Parse `q` and `types` query params
  - Validate minimum query length (2 chars)
  - Call globalSearch from lib
  - Return JSON response with proper error handling

- [ ] **1.3** Add types to `database.ts`
  - SearchResults interface
  - SearchResultItem union type (if needed)

### Phase 2: Search Modal (4 tasks)

- [ ] **2.1** Create basic SearchModal component structure
  - Modal overlay with backdrop
  - Search input with focus trap
  - Close on Escape/backdrop click
  - Portal render to body

- [ ] **2.2** Add search results sections
  - Categorized sections (Rocks, Issues, etc.)
  - Result item component with icon + title + meta
  - Empty state per section
  - Overall empty state ("No results found")

- [ ] **2.3** Style SearchModal with design system
  - Match existing card/modal patterns
  - Dark mode support
  - Responsive sizing (full width on mobile)
  - Subtle animations

- [ ] **2.4** Add keyboard navigation
  - Arrow up/down to navigate results
  - Enter to select highlighted item
  - Tab to move between sections
  - Visual highlight indicator

### Phase 3: Integration (3 tasks)

- [ ] **3.1** Create useSearch hook
  - Manage search query state
  - Debounce API calls (300ms)
  - Track loading/error states
  - Cache recent results

- [ ] **3.2** Wire Header search input
  - Click opens SearchModal
  - Pass query state to modal
  - Keep input synced with modal input

- [ ] **3.3** Add global Cmd+K shortcut
  - Event listener on window
  - Prevent default browser behavior
  - Open modal when triggered
  - Works from any page

### Phase 4: Polish (2 tasks)

- [ ] **4.1** Add loading and empty states
  - Skeleton loaders during fetch
  - "Type to search" initial state
  - "No results" with suggestions
  - Error state with retry

- [ ] **4.2** Add keyboard hints and accessibility
  - Hint bar at bottom ("↑↓ Navigate • Enter Select • Esc Close")
  - ARIA labels for screen readers
  - Focus management
  - Test with keyboard-only navigation

## Success Criteria

- [ ] Search returns results from all entity types
- [ ] Results link to correct detail pages
- [ ] Cmd+K opens search from anywhere
- [ ] Works in both light and dark mode
- [ ] Debouncing prevents excessive API calls
- [ ] Keyboard navigation is fully functional
- [ ] Mobile-responsive design

## Future Enhancements (Not in Scope)

- Full-text search with PostgreSQL tsvector indexes
- Semantic search using transcript embeddings
- Search history / recent searches
- Saved searches / filters
- Search within specific date ranges
