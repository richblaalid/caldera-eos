# Plan: Scorecard Metric Recommendations from Transcripts

## Overview

Implement the PRD requirement (line 105): "Suggest new metrics based on conversation patterns"

When processing meeting transcripts, Ember will detect potential scorecard metrics mentioned in conversations and surface them as suggestions for the team to review and optionally add to the scorecard.

## Problem Statement

Currently, transcript processing extracts:
- Issues (for IDS tracking)
- To-dos (7-day action items)
- Decisions (for documentation)

It does **not** extract potential scorecard metrics, even though conversations often reveal unmeasured KPIs:
- "We should be tracking weekly sales calls"
- "John mentioned our close rate is around 30%"
- "We need visibility into utilization rates"

## Technical Approach

### Phase 1: Extend Transcript Extraction

Modify the AI extraction prompt in `ember/src/lib/transcripts.ts` to also identify potential metrics.

**New extraction type:**
```typescript
export interface ExtractedMetric {
  type: 'metric'
  name: string              // e.g., "Weekly Sales Calls"
  description?: string      // What this measures
  suggested_target?: string // If mentioned (e.g., "20 calls per week")
  owner?: string           // Who mentioned it or would own it
  frequency?: string       // weekly, monthly, etc.
  context: string          // Quote from transcript
}
```

**Updated ExtractionResult:**
```typescript
export interface ExtractionResult {
  issues: ExtractedItem[]
  todos: ExtractedItem[]
  decisions: ExtractedItem[]
  metrics: ExtractedMetric[]  // NEW
  summary: string
}
```

### Phase 2: Generate Insights for New Metrics

After extraction, compare detected metrics against existing scorecard metrics. For each **new** metric (not already tracked), create an Insight record:

```typescript
{
  type: 'suggestion',
  title: 'Suggested Metric: Weekly Sales Calls',
  content: 'During the L10 meeting, John mentioned tracking weekly sales calls. Consider adding this to the scorecard.',
  priority: 2,
  sources: [{ type: 'transcript', id: transcriptId, title: meetingTitle }],
  related_entities: { metrics: [] }  // Empty until accepted
}
```

### Phase 3: Display Suggestions in UI

Add a "Suggested Metrics" section to either:
- The Scorecard page (`/dashboard/scorecard`)
- The Insights feed on the main dashboard

Each suggestion shows:
- Metric name and description
- Source quote from transcript
- "Add to Scorecard" button
- "Dismiss" button

### Phase 4: Accept/Dismiss Flow

**Accept:** Opens the "New Metric" form pre-populated with:
- Name from suggestion
- Description from suggestion
- Target from suggestion (if available)
- Owner from suggestion (if available)

On save, the insight is marked as acknowledged and linked to the new metric.

**Dismiss:** Marks insight as acknowledged without creating metric.

## Files to Modify

| File | Changes |
|------|---------|
| `ember/src/lib/transcripts.ts` | Add `ExtractedMetric` type, update extraction prompt, update `ExtractionResult` |
| `ember/src/lib/eos.ts` | Add `createInsight()` function, add `getExistingMetricNames()` helper |
| `ember/src/app/api/transcripts/[id]/process/route.ts` | Call insight generation after extraction |
| `ember/src/app/dashboard/scorecard/page.tsx` | Add "Suggested Metrics" section |
| `ember/src/types/database.ts` | Add `ExtractedMetric` interface |

## New Files

| File | Purpose |
|------|---------|
| `ember/src/lib/metric-suggestions.ts` | Logic to compare extracted metrics vs existing, generate insights |
| `ember/src/app/api/insights/[id]/accept-metric/route.ts` | API to accept a suggestion and create metric |

## Data Flow

```
Transcript Upload
       ↓
extractFromChunk() ← Updated to detect metrics
       ↓
mergeExtractionResults() ← Includes metrics
       ↓
compareWithExistingMetrics() ← NEW
       ↓
createInsight() for each new metric ← NEW
       ↓
Display in Scorecard/Dashboard UI
       ↓
User accepts → Pre-fill new metric form
```

## AI Prompt Addition

Add to `EXTRACTION_SYSTEM_PROMPT`:

```
4. **Potential Metrics** - Numbers or KPIs mentioned that could be tracked on a scorecard:
   - Weekly/monthly metrics mentioned (calls, revenue, utilization, etc.)
   - Targets or goals discussed
   - Numbers the team wants visibility into
   - Measurements that would help track progress
```

Add to extraction JSON structure:

```json
"metrics": [
  {
    "type": "metric",
    "name": "Weekly Sales Calls",
    "description": "Number of outbound sales calls made each week",
    "suggested_target": "20",
    "owner": "John",
    "frequency": "weekly",
    "context": "John said we should track our weekly calls - aiming for at least 20"
  }
]
```

## Edge Cases

1. **Duplicate detection** - Compare extracted metric names against existing `scorecard_metrics.name` using fuzzy matching
2. **Vague mentions** - Only extract when a specific measurable is mentioned, not general "we should track things"
3. **Already exists** - Skip insight creation if metric already exists (with similar name)
4. **Dismissed suggestions** - Track dismissed suggestions to avoid re-surfacing

## Verification

1. Upload a test transcript containing metric mentions
2. Verify extraction includes `metrics` array
3. Check insights table for new `suggestion` type records
4. Navigate to Scorecard page and see suggested metrics
5. Click "Add to Scorecard" and verify form pre-population
6. Save metric and verify insight is acknowledged

## Task Breakdown

### Phase 1: Extend Extraction (Tasks 1-3)
- [ ] 1.1 Add `ExtractedMetric` interface to types
- [ ] 1.2 Update extraction prompt to include metrics
- [ ] 1.3 Update `ExtractionResult` and `mergeExtractionResults()`

### Phase 2: Generate Insights (Tasks 4-6)
- [ ] 2.1 Add `getExistingMetricNames()` helper in eos.ts
- [ ] 2.2 Create `metric-suggestions.ts` with comparison logic
- [ ] 2.3 Add `createInsight()` function to eos.ts
- [ ] 2.4 Update transcript processing to call insight generation

### Phase 3: Display UI (Tasks 7-9)
- [ ] 3.1 Add "Suggested Metrics" component to Scorecard page
- [ ] 3.2 Fetch and display pending metric suggestions
- [ ] 3.3 Add "Add to Scorecard" / "Dismiss" buttons

### Phase 4: Accept Flow (Tasks 10-11)
- [ ] 4.1 Create `/api/insights/[id]/accept-metric` endpoint
- [ ] 4.2 Pre-populate new metric form from suggestion data
- [ ] 4.3 Update insight on metric creation

## Dependencies

- Existing transcript processing pipeline
- Existing insights table schema
- Existing scorecard metrics API

## Risks

| Risk | Mitigation |
|------|------------|
| Too many false positives | Tune prompt to be conservative; require specific numbers |
| Duplicate suggestions | Fuzzy match against existing metrics |
| Suggestions ignored | Surface prominently; include in meeting prep |
