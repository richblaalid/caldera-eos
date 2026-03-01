# Plan: Hybrid Work Queue Prioritization

**Status:** Draft
**Created:** 2026-03-01
**Scope:** Restructure the Ember Work Queue in daily briefings to ensure important agent outputs are never lost, with day-of-week awareness and priority-based grouping.

---

## Problem

The current work queue in `getPendingAgentOutputs()` fetches the 10 most recent `agent_outputs` sorted by `created_at DESC` with no prioritization. On busy nights when 5+ agents each produce 2-4 outputs, critical zone-2 items (issues needing approval, alerts) can be crowded out by routine zone-1 analyses. There is also no day-of-week awareness — L10 Prep appears daily even though it's only relevant on Mondays.

## Solution: Hybrid Two-Section Work Queue

Replace the flat, recency-sorted work queue with two visually distinct sections:

### Section 1: "Needs Your Decision"
- **All** zone-2 `pending_review` items — these require partner action and must never be dropped
- Sorted by output_type priority: `alert` > `issue` > `recommendation` > `analysis` > `draft` > `briefing`
- Numbered sequentially (1, 2, 3...) — these are the items partners can approve/reject/defer
- No per-agent limit — if 8 items need decisions, show all 8

### Section 2: "Agent Insights"
- Top 1 zone-1 `completed` item per agent (the most important output from each agent)
- Grouped by agent with emoji + name as header
- Priority within each agent: `alert` > `issue` > `recommendation` > `analysis`
- Day-of-week filtering:
  - L10 Prep (`agent_id: 'ea'`, `output_type: 'briefing'`) — **Monday only**
  - All other agents — daily
- Not numbered (no approve/reject actions needed for zone-1 items)
- Agents with 0 outputs in the window are simply absent (no empty slots)

### Slack Layout

```
:rotating_light: *Needs Your Decision* (3)
:yellow-card: *1.* Cash flow alert needs review _[:bank: Financial Strategist]_
      Cash flow runway decreased to 45 days
:yellow-card: *2.* New competitor positioning _[:mega: Marketing Strategist]_
      Recommend updating positioning for enterprise segment
:yellow-card: *3.* Delivery risk on Project X _[:gear: Operations Architect]_
      Utilization gap flagged — suggest creating an Issue
_Reply: "approve 1", "reject 2 — reason", or "defer 3 to Friday"_

─────────────
:crystal_ball: *Agent Insights*
:bank: *Financial* — Runway stable at 90 days, AR aging improved week-over-week
:dart: *BD* — Pipeline at $425K across 8 deals, 3 closing this week
:gear: *Operations* — Team utilization at 78%, bench rate healthy
:mega: *Marketing* — 2 content pieces driving inbound leads
:mag: *Patterns* — Revenue concentration decreasing quarter-over-quarter (positive trend)
```

On Mondays, L10 Prep appears in Agent Insights:
```
:calendar: *L10 Prep* — Focus on Rock progress review; 3 off-track metrics to discuss
```

---

## Files to Modify

| File | Change |
|------|--------|
| `ember/src/lib/agents/ea-briefing.ts` | Rewrite `getPendingAgentOutputs()` — remove hard limit, add output_type priority sort, add day-of-week filtering. Update `generateBriefing()` to build two separate arrays (decisions + insights) instead of one flat `agentWorkQueue`. |
| `ember/src/types/agents.ts` | Add `AgentInsightItem` interface for the insights section (no `id` number, no `output_id`). Keep `AgentWorkItem` for the decisions section. Add to `BriefingInsertV2` type. |
| `ember/src/lib/agents/slack-briefing.ts` | Rewrite work queue rendering in both `formatBriefingBlocks()` (v1) and `formatV2Blocks()` (v2) — two sections instead of one flat list. Update stats line to reflect decision count. |
| `ember/src/lib/agents/command-executor.ts` | `resolveWorkQueueItems()` already reads from `agent_work_queue` JSONB — no change needed as long as the decisions section items retain the `id` + `output_id` structure. |

### Files NOT modified
- No database migration needed — `agent_work_queue` is JSONB and accepts any shape
- No changes to individual agent files — they already write `output_type` and `trust_zone` correctly
- No changes to `command-parser.ts` — approve/reject/defer commands still reference item numbers

---

## Implementation Phases

### Phase 1: Data Layer — Priority Fetch + Grouping
**File:** `ember/src/lib/agents/ea-briefing.ts`

1. **Rewrite `getPendingAgentOutputs()`**:
   - Remove `.limit(10)`
   - Fetch up to 50 items (safety cap) with all needed fields
   - Add day-of-week param to enable filtering

2. **Add `buildWorkQueueSections()` function**:
   - Input: raw agent outputs array + `isMonday` boolean
   - Split into two buckets:
     - `decisions`: zone-2 `pending_review` items
     - `insights`: zone-1 `completed` items, deduplicated to top-1-per-agent
   - Apply output_type priority sort to both buckets:
     ```typescript
     const OUTPUT_TYPE_PRIORITY: Record<string, number> = {
       'alert': 0,
       'issue': 1,
       'recommendation': 2,
       'analysis': 3,
       'draft': 4,
       'briefing': 5,
     }
     ```
   - Filter out L10 Prep items (`agent_id === 'ea' && output_type === 'briefing'`) on non-Mondays
   - Number the decisions sequentially (1, 2, 3...)
   - Return `{ decisions: AgentWorkItem[], insights: AgentInsightItem[] }`

3. **Update `generateBriefing()` call site** (lines 170-179):
   - Call `buildWorkQueueSections()` instead of the current `.map()`
   - Store both arrays in the briefing object

### Phase 2: Types
**File:** `ember/src/types/agents.ts`

1. **Add `AgentInsightItem` interface**:
   ```typescript
   export interface AgentInsightItem {
     agent_id: string
     agent_name: string
     title: string
     summary: string
     output_type: string
   }
   ```

2. **Update `BriefingInsertV2`** (and `BriefingInsert` for v1 compat):
   - Add `agent_insights?: AgentInsightItem[]` field
   - Keep `agent_work_queue` as the decisions-only array

### Phase 3: Slack Formatting
**File:** `ember/src/lib/agents/slack-briefing.ts`

1. **Update `formatV2Blocks()`** (primary — v2 is the active format):
   - Render "Needs Your Decision" section from `agent_work_queue` (zone-2 items only)
   - Render "Agent Insights" section from `agent_insights` (one-liner per agent)
   - Update stats line: show decision count separately
   - Only show approve/reject/defer hint under the decisions section
   - Skip sections entirely if empty (no "Needs Your Decision" header when there are none)

2. **Update `formatBriefingBlocks()`** (v1 compat):
   - Same structure for v1 format if `agent_insights` is present
   - Graceful fallback to old flat list if `agent_insights` is missing (backward compat)

3. **Update fallback text** in `deliverBriefing()` to reflect new structure

### Phase 4: Verification
1. Run `npm run typecheck` — zero errors
2. Run `npm run test` — all pass
3. Run `npm run build` — success
4. Manual test via `/api/agents/test/pipeline?step=all` to verify end-to-end

---

## Design Decisions

**Why not add a `priority` column to `agent_outputs`?**
Not needed yet. The `output_type` + `trust_zone` combination provides sufficient priority signal. If agents need finer control in the future, we can add it then without changing the briefing logic (just update the sort key).

**Why keep `agent_work_queue` as the decisions array name?**
The command executor's `resolveWorkQueueItems()` reads this field. Keeping the same field name means zero changes to the approve/reject/defer flow — it just works.

**Why top-1 per agent instead of top-3?**
With 7 agents, top-3 would mean up to 21 insight lines. Partners scan briefings in 15-60 seconds. One headline per agent is scannable; three per agent is a wall of text. If a partner wants more detail, they can ask Ember in the thread.

**Why filter L10 Prep to Monday only?**
L10 Prep is already delivered as a separate Slack message by the morning-briefing cron. It also saves to `agent_outputs`, which means it double-appears in the work queue. Filtering it to Monday-only in the insights section provides a useful "heads up: L10 tomorrow" signal without cluttering Tue-Fri briefings with stale prep data.

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Large number of zone-2 items overwhelming the decisions section | Unlikely with current agent cadence (max ~5 agents produce zone-2 items, each 0-2 per run). If it grows, we can add a cap of 10 decisions with a "and N more in Ember" link. |
| Backward compat — old briefings in DB lack `agent_insights` | Null check in formatter; falls back to flat `agent_work_queue` rendering. |
| Slack Block Kit 50-block limit | Decisions section is compact (1 block per item). Insights section is ~7 lines. Well within limits. |
