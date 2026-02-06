# Plan: Surface Transcript Extractions on Meeting Detail Page

## Summary
Add a tabbed interface to the meeting detail page that displays linked transcripts and their extracted items (issues, todos, metrics, decisions) with action buttons to create EOS items directly from the meeting context.

## Current State
- Meeting detail page shows: AI prep, meeting details, quick links
- Transcripts have `meeting_id` foreign key linking to meetings
- API already supports `GET /api/eos/transcripts?meeting_id=xxx`
- Transcript page has working "Create Issue" / "Create Todo" with `created` tracking
- Extractions stored in transcript's `extractions` JSONB field

## Design Decisions

### Tabbed Interface
- **Details Tab**: Current meeting page content
- **Transcripts Tab**: Linked transcripts with extractions

### Extractions Display
- Collapsible sections by type: Issues, To-dos, Metrics, Decisions
- Each item shows: title, context quote, source transcript link
- Action buttons: "Create Issue", "Create Todo", "Add to Scorecard"
- "Created" badge for items already converted
- Dismiss button to hide items

### Transcripts Section
- List of attached transcripts as cards
- "Process" button for unprocessed transcripts
- Processing status indicator
- Click to expand/view full transcript

---

## Implementation

### Phase 1: API Enhancement

#### Task 1.1: Create Meeting Transcripts Endpoint
**File:** `ember/src/app/api/eos/meetings/[id]/transcripts/route.ts` (NEW)

- GET endpoint that returns transcripts for a meeting
- Include extractions and processing status
- Return transcript title, processed state, extraction counts

```typescript
// GET /api/eos/meetings/[id]/transcripts
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const transcripts = await getTranscripts({ meeting_id: id })
  return NextResponse.json(transcripts)
}
```

---

### Phase 2: UI Components

#### Task 2.1: Create Tabs Component
**File:** `ember/src/components/ui/Tabs.tsx` (NEW if not exists)

- Simple tabs component with active state
- Accepts tabs array and onChange callback
- Styled to match existing UI

#### Task 2.2: Create ExtractionSection Component
**File:** `ember/src/components/transcripts/ExtractionSection.tsx` (NEW)

Collapsible section for extraction type:
- Props: `title`, `items`, `type`, `onAction`, `onDismiss`, `sourceTranscript`
- Expandable/collapsible with item count in header
- Renders ExtractionItem for each item

```typescript
interface ExtractionSectionProps {
  title: string
  icon: React.ReactNode
  items: TranscriptExtractedItem[] | ExtractedMetric[]
  type: 'issues' | 'todos' | 'decisions' | 'metrics'
  sourceTranscript: { id: string; title: string }
  onCreateItem: (item: TranscriptExtractedItem, type: string) => void
  onDismiss: (item: TranscriptExtractedItem, type: string) => void
  isCreating: string | null
}
```

#### Task 2.3: Create ExtractionItem Component
**File:** `ember/src/components/transcripts/ExtractionItem.tsx` (NEW)

Individual extraction item display:
- Title (bold)
- Context quote (italic, truncated)
- Source transcript link
- Action button (Create Issue / Create Todo / Add to Scorecard)
- "Created" badge if already converted
- Dismiss button

#### Task 2.4: Create TranscriptCard Component
**File:** `ember/src/components/transcripts/TranscriptCard.tsx` (NEW)

Compact card for transcript attachment:
- Title, date, processing status
- Extraction counts (X issues, Y todos, Z metrics)
- "Process" button if unprocessed
- Link to full transcript page

---

### Phase 3: Meeting Page Enhancement

#### Task 3.1: Add Tabs to Meeting Page
**File:** `ember/src/app/dashboard/meetings/[id]/page.tsx`

- Import Tabs component
- Add state for active tab
- Wrap existing content in "Details" tab
- Add "Transcripts" tab content

#### Task 3.2: Create TranscriptsTab Component
**File:** `ember/src/components/meetings/TranscriptsTab.tsx` (NEW)

Main content for transcripts tab:
- Fetch transcripts for meeting on mount
- Show "No transcripts" empty state with upload prompt
- List TranscriptCard components
- Aggregate extractions from all transcripts
- Render ExtractionSection for each type

```typescript
interface TranscriptsTabProps {
  meetingId: string
  meetingTitle: string
}
```

#### Task 3.3: Wire Up Action Handlers
**File:** `ember/src/components/meetings/TranscriptsTab.tsx`

- `handleCreateIssue`: POST to /api/eos/issues, update extraction
- `handleCreateTodo`: POST to /api/eos/todos, update extraction
- `handleAddMetric`: Navigate to /dashboard/scorecard/metrics/new with query params
- `handleDismiss`: Update extraction to remove item
- `handleProcess`: POST to /api/eos/transcripts/[id]/process

#### Task 3.4: Update Extractions After Action
**File:** `ember/src/app/api/eos/transcripts/[id]/route.ts`

Ensure PUT endpoint can update `extractions` JSONB field (already supported).

---

### Phase 4: Polish & UX

#### Task 4.1: Add Loading States
- Skeleton loading for transcripts fetch
- Processing spinner with progress indicator
- Creating item loading state per item

#### Task 4.2: Add Empty States
- No transcripts: "No transcripts attached. Upload a transcript to see extracted items."
- No extractions: "This transcript has been processed but no actionable items were found."
- Section empty: Hide sections with 0 items

#### Task 4.3: Add Success Feedback
- Toast/flash message when item created
- Visual update (badge change) after creation

---

## Files to Create
1. `ember/src/app/api/eos/meetings/[id]/transcripts/route.ts`
2. `ember/src/components/ui/Tabs.tsx` (if not exists)
3. `ember/src/components/transcripts/ExtractionSection.tsx`
4. `ember/src/components/transcripts/ExtractionItem.tsx`
5. `ember/src/components/transcripts/TranscriptCard.tsx`
6. `ember/src/components/meetings/TranscriptsTab.tsx`

## Files to Modify
1. `ember/src/app/dashboard/meetings/[id]/page.tsx` - Add tabs and transcripts tab

## No Changes Needed
- Database schema (meeting_id FK already exists)
- Transcript processing (already extracts items)
- Issue/Todo creation APIs (already exist)

---

## Component Hierarchy

```
MeetingDetailPage
├── Tabs
│   ├── "Details" (existing content)
│   └── "Transcripts"
│       └── TranscriptsTab
│           ├── TranscriptCard (per transcript)
│           │   └── Process button / Status
│           └── Extraction Sections (aggregated)
│               ├── ExtractionSection (Issues)
│               │   └── ExtractionItem[]
│               ├── ExtractionSection (To-dos)
│               │   └── ExtractionItem[]
│               ├── ExtractionSection (Metrics)
│               │   └── ExtractionItem[]
│               └── ExtractionSection (Decisions)
│                   └── ExtractionItem[]
```

---

## Verification

1. Navigate to a meeting with linked transcripts
2. See "Transcripts" tab with count indicator
3. Click tab to see transcript cards
4. See collapsible sections for each extraction type
5. Click "Create Issue" - issue created, badge shows "Created"
6. Click "Add to Scorecard" - navigates to metric form pre-filled
7. Click transcript link - navigates to transcript detail page
8. Process unprocessed transcript from meeting page
