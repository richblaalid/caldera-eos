# Tasks: Scorecard Metric Recommendations from Transcripts

**Related Plan:** `docs/plans/scorecard-recommendations-from-transcripts.md`

---

## Phase 1: Extend Transcript Extraction

### Task 1.1: Add ExtractedMetric Interface
**File:** `ember/src/types/database.ts`
**Estimate:** 5 min

- [x] Add `ExtractedMetric` interface after `TranscriptExtractedItem` (around line 330)
- [x] Include fields: `type`, `name`, `description`, `suggested_target`, `owner`, `frequency`, `context`

```typescript
export interface ExtractedMetric {
  type: 'metric'
  name: string
  description?: string
  suggested_target?: string
  owner?: string
  frequency?: 'weekly' | 'monthly' | 'quarterly' | 'daily'
  context: string
}
```

---

### Task 1.2: Update Extraction Types in transcripts.ts
**File:** `ember/src/lib/transcripts.ts`
**Estimate:** 5 min

- [x] Import or define `ExtractedMetric` type
- [x] Add `metrics: ExtractedMetric[]` to `ExtractionResult` interface (line 141)
- [x] Update `emptyResult()` to include `metrics: []`

---

### Task 1.3: Update AI Extraction Prompt
**File:** `ember/src/lib/transcripts.ts`
**Estimate:** 15 min

- [x] Update `EXTRACTION_SYSTEM_PROMPT` to include metrics extraction guidance
- [x] Update the JSON structure in `extractFromChunk()` user prompt
- [x] Add metrics parsing to the response handler
- [x] Update `mergeExtractionResults()` to handle metrics array

**Prompt addition:**
```
4. **Potential Metrics** - Measurable KPIs mentioned that could be tracked on a scorecard:
   - Weekly/monthly numbers mentioned (calls made, revenue, utilization, etc.)
   - Specific targets or goals discussed with numbers
   - Measurements the team wants visibility into
   Only extract when a SPECIFIC measurable number or KPI is mentioned.
```

---

## Phase 2: Generate Insights

### Task 2.1: Add Metric Name Helper
**File:** `ember/src/lib/eos.ts`
**Estimate:** 10 min

- [x] Add `getExistingMetricNames()` function that returns all current scorecard metric names
- [x] Return lowercase names for comparison

```typescript
export async function getExistingMetricNames(): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('scorecard_metrics')
    .select('name')
    .eq('is_active', true)
  return (data || []).map(m => m.name.toLowerCase())
}
```

---

### Task 2.2: Create Metric Suggestions Module
**File:** `ember/src/lib/metric-suggestions.ts` (NEW)
**Estimate:** 15 min

- [x] Create new file
- [x] Import types and helpers
- [x] Add `isMetricNew()` function for fuzzy matching
- [x] Add `generateMetricSuggestions()` function that:
  - Takes extracted metrics array
  - Filters out existing metrics
  - Creates insight records for new ones
  - Returns created insight IDs

```typescript
import { getExistingMetricNames, createInsight } from './eos'
import type { ExtractedMetric, InsightInsert } from '@/types/database'

export async function generateMetricSuggestions(
  metrics: ExtractedMetric[],
  transcriptId: string,
  transcriptTitle: string
): Promise<string[]> {
  // Implementation
}
```

---

### Task 2.3: Add createInsight Function
**File:** `ember/src/lib/eos.ts`
**Estimate:** 10 min

- [x] Add `createInsight()` function
- [x] Include organization_id handling
- [x] Return created insight

```typescript
export async function createInsight(insight: InsightInsert): Promise<Insight | null> {
  const supabase = await createClient()
  const orgId = await getUserOrganizationId(supabase)
  if (!orgId) return null

  const { data, error } = await supabase
    .from('insights')
    .insert({ ...insight, organization_id: orgId })
    .select()
    .single()

  return error ? null : data
}
```

---

### Task 2.4: Integrate with Transcript Processing
**File:** `ember/src/app/api/transcripts/[id]/process/route.ts`
**Estimate:** 15 min

- [x] Import `generateMetricSuggestions` from new module
- [x] After extraction merging, call `generateMetricSuggestions()`
- [x] Pass transcript ID and title
- [x] Log number of suggestions created

---

## Phase 3: Display Suggestions UI

### Task 3.1: Create SuggestedMetrics Component
**File:** `ember/src/components/scorecard/SuggestedMetrics.tsx` (NEW)
**Estimate:** 20 min

- [ ] Create component that fetches pending metric suggestions
- [ ] Display each suggestion with:
  - Metric name (bold)
  - Description
  - Source quote in italics
  - "Add to Scorecard" button (primary)
  - "Dismiss" button (ghost)
- [ ] Handle empty state

---

### Task 3.2: Add API for Fetching Metric Suggestions
**File:** `ember/src/app/api/insights/suggestions/route.ts` (NEW)
**Estimate:** 10 min

- [ ] Create GET endpoint
- [ ] Query insights where `type = 'suggestion'` and `title LIKE 'Suggested Metric:%'`
- [ ] Filter to unacknowledged only
- [ ] Return with source transcript info

---

### Task 3.3: Add to Scorecard Page
**File:** `ember/src/app/dashboard/scorecard/page.tsx`
**Estimate:** 10 min

- [ ] Import SuggestedMetrics component
- [ ] Add section above or below current metrics table
- [ ] Only show when suggestions exist

---

## Phase 4: Accept/Dismiss Flow

### Task 4.1: Create Accept Metric Endpoint
**File:** `ember/src/app/api/insights/[id]/accept-metric/route.ts` (NEW)
**Estimate:** 15 min

- [ ] Create POST endpoint
- [ ] Extract suggestion data from insight content (parse JSON from content field)
- [ ] Return pre-populated metric data for form
- [ ] Mark insight as acknowledged after metric created (separate call)

---

### Task 4.2: Create Dismiss Endpoint
**File:** `ember/src/app/api/insights/[id]/dismiss/route.ts` (NEW)
**Estimate:** 10 min

- [ ] Create POST endpoint
- [ ] Mark insight as acknowledged
- [ ] Return success

---

### Task 4.3: Wire Up Accept Flow in Component
**File:** `ember/src/components/scorecard/SuggestedMetrics.tsx`
**Estimate:** 15 min

- [ ] On "Add to Scorecard" click, call accept endpoint
- [ ] Navigate to `/dashboard/scorecard/metrics/new` with query params for pre-population
- [ ] Or open modal with pre-filled form

---

### Task 4.4: Handle Pre-population in New Metric Page
**File:** `ember/src/app/dashboard/scorecard/metrics/new/page.tsx`
**Estimate:** 10 min

- [ ] Read query params for pre-population (`name`, `description`, `target`, `owner`, `insightId`)
- [ ] Pre-fill form fields if params present
- [ ] After save, acknowledge the insight via API

---

## Verification Tasks

### Task V.1: Test Extraction
**Estimate:** 10 min

- [ ] Create test transcript with metric mentions
- [ ] Run extraction and verify metrics array populated
- [ ] Check that vague mentions are not extracted

---

### Task V.2: Test Insight Generation
**Estimate:** 10 min

- [ ] Process test transcript
- [ ] Query insights table for new suggestions
- [ ] Verify source linking is correct

---

### Task V.3: End-to-End Test
**Estimate:** 15 min

- [ ] Upload transcript with metric mention
- [ ] Navigate to Scorecard page
- [ ] See suggestion appear
- [ ] Click "Add to Scorecard"
- [ ] Save metric
- [ ] Verify suggestion disappears

---

## Summary

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| Phase 1: Extraction | 3 tasks | 25 min |
| Phase 2: Insights | 4 tasks | 50 min |
| Phase 3: UI | 3 tasks | 40 min |
| Phase 4: Accept Flow | 4 tasks | 50 min |
| Verification | 3 tasks | 35 min |
| **Total** | **17 tasks** | **~3.5 hours** |
