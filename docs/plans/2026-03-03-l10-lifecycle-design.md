# Design: Calendar-Driven L10 Lifecycle

**Date:** 2026-03-03
**Status:** Approved

## Problem

L10 meeting prep requires manually-created records in Ember's `meetings` table, which nobody uses. The actual L10 is a recurring Google Calendar event (Tuesday mornings). After the meeting, Grain captures the transcript, but the team has to manually extract action items. There's no automated pre-meeting → meeting → post-meeting lifecycle.

## Solution

Three connected pieces that use Google Calendar as the source of truth for L10 scheduling:

### Part 1: Pre-Meeting L10 Prep

**Trigger:** Morning briefing cron (7:30 AM CT weekdays) detects an L10 on today's calendar.

**Detection:** Query `ingested_data` for today's calendar events where `payload->>'event_type' = 'l10'`. The calendar connector already classifies events with titles containing "l10", "level 10", or "level ten" as `event_type: 'l10'`.

**Content:** Same EOS data prep as existing `generateMeetingPrep()`:
- Rocks status summary (on track / off track / complete)
- Priority issues for IDS
- Scorecard highlights and misses
- Overdue or notable to-dos

**Delivery:** Post to `#caldera-eos` Slack channel — shared team context, not individual DMs.

**Dedup:** Track L10 prep delivery in `agent_outputs` by date to prevent duplicate sends on cron retry.

### Part 2: Post-Meeting L10 Recap

**Trigger:** Transcript ingestion cron (every 30 min during work hours) ingests a new L10 transcript from Grain.

**Detection:** After the existing ingestion + processing pipeline runs, check if any newly-created `ingested_data` records have `data_type = 'transcript_summary'` and `meeting_type = 'l10'` in the payload.

**Content:** Generated from transcript extractions + full text:
- Decisions made
- IDS outcomes (issues discussed, resolutions)
- New action items identified (with owner if mentioned)
- Rock updates mentioned
- Key discussion points

**Delivery:** Post to `#caldera-eos` Slack channel — shared team recap.

### Part 3: Auto-Create EOS Items

**Trigger:** Runs immediately after L10 recap generation.

**Source data:** Transcript `extractions` from Grain AI notes (decisions, action items, issues) plus LLM-extracted items from the full transcript text.

**Items created:**
- **Issues** — via `createAgentIssue()` with source `'L10 Recap'`
- **To-dos** — via `createTodo()` with 7-day due date, owner assigned by name match

**Noise controls:**

| Guard | Rule | Rationale |
|-------|------|-----------|
| Source labeling | `createAgentIssue()` with source `'L10 Recap'` | Matches existing agent pattern; clearly attributable |
| Deduplication | Fuzzy-match against existing open Issues/Todos by title | Prevents duplicates if manually entered |
| Cap per meeting | Max 5 Issues + 5 To-dos per L10 | Prevents LLM hallucination from flooding system |
| Confidence threshold | Only items explicitly stated as decisions/action items | Not inferred; Grain's AI notes already filter |
| Owner matching | Match owner by first name against partner profiles | Only assign if confident match; leave unassigned otherwise |

**Delivery:** Each partner receives a personal Slack DM listing the Issues and To-dos assigned to them:

> *From your L10 today:*
> *To-dos assigned to you:*
> - Follow up with Pivotal on SOW (due Mar 10)
> - Review updated cash flow projections (due Mar 10)
>
> *Issues created for L10:*
> - Pipeline coverage below 3x target

Partners who have no assigned items receive no DM (no noise).

## Delivery Summary

| Content | Destination | Format |
|---------|-------------|--------|
| L10 Prep | `#caldera-eos` channel | Morning of L10, ~7:30 AM CT |
| L10 Recap | `#caldera-eos` channel | After transcript ingested (~30 min post-meeting) |
| Personal action items | Partner DMs | After recap, only to partners with assigned items |

## Data Flow

```
Google Calendar (recurring Tuesday L10)
    |
    | (ingested every 15 min → ingested_data, event_type='l10')
    |
    v
Morning Briefing Cron (7:30 AM CT)
    |
    |-- Detects L10 today? → Generate prep → Post to #caldera-eos
    |
    v
L10 Meeting happens (Tuesday morning)
    |
    v
Grain captures transcript (available within minutes)
    |
    | (ingested every 30 min → transcripts → ingested_data)
    |
    v
Transcript Cron detects new L10 transcript
    |
    |-- Generate recap → Post to #caldera-eos
    |-- Extract Issues/To-dos → Create in Ember
    |-- DM each partner their assigned items
```

## Files Affected

| File | Change |
|------|--------|
| `lib/agents/l10-prep.ts` | New — L10 prep generation from calendar + EOS data |
| `lib/agents/l10-recap.ts` | New — L10 recap + EOS item extraction from transcript |
| `app/api/agents/cron/morning-briefing/route.ts` | Add L10 prep detection + channel delivery |
| `app/api/agents/cron/ingest/transcripts/route.ts` | Add post-ingestion L10 recap trigger |
| `lib/agents/slack-briefing.ts` | Add channel posting helper (currently only DMs) |
| `lib/agents/agent-runtime.ts` | May need `createAgentTodo()` helper (currently only Issues) |

## Cost Estimate

- L10 prep generation: 1 Sonnet call/week (~$0.01)
- L10 recap generation: 1 Sonnet call/week (~$0.02)
- EOS item extraction: included in recap call
- Slack messages: 1 channel + up to 3 DMs per L10

## Non-Goals

- Auto-creating `meetings` table records (YAGNI — the table is unused)
- Supporting non-L10 meeting types in this flow (future enhancement)
- Real-time webhook from Grain (they don't offer one)
