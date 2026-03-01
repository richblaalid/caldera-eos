# Slack Formatting Fixes Plan

## Overview

Audit-driven fixes to Slack message formatting across the Ember agent system. Addresses mrkdwn safety, Block Kit structural issues, and missed Slack platform features. No new features — strictly hardening existing messages.

## Audit Source

Full mrkdwn + Block Kit audit performed against two skill references:
- `.claude/skills/slack-mrkdwn/SKILL.md` — mrkdwn syntax, escaping, dates, links
- `.agents/skills/slack-block-kit/SKILL.md` — Block Kit structure, limits, best practices

## Current State

**Files with Slack formatting (6 core files):**

| File | Purpose | Message Types |
|------|---------|---------------|
| `lib/agents/slack-briefing.ts` | Morning briefing delivery | Header, urgent items, business updates, news, work queue, footer |
| `app/api/agents/cron/morning-briefing/route.ts` | Cron orchestrator | Pre-call briefs, L10 prep, nudge delivery |
| `lib/agents/nudge-engine.ts` | Accountability nudges | Escalation alerts (levels 1-3) |
| `lib/connectors/slack-connector.ts` | Low-level Slack client | System alerts, block message posting |
| `lib/slack.ts` | Legacy Slack client | Checkup reminders |
| `app/api/agents/cron/scorecard-automation/route.ts` | Weekly scorecard | Manual metric prompts |
| `lib/agents/command-executor.ts` | DM command handler | Approve/reject/defer confirmations, EA freeform replies |

## Findings (Priority Order)

### Phase 1: Safety & Correctness (High Priority)

**1A. No mrkdwn escaping of user-generated content**

All interpolated EOS data (`item.title`, `item.detail`, `nudge.itemTitle`, `output.title`, `brief.attendees`) could contain `&`, `<`, or `>`. A rock title like `Revenue > $500K` would break mrkdwn parsing (Slack interprets `<` and `>` as link/mention delimiters).

**Fix:** Create `escapeSlackMrkdwn()` utility. Apply to all user-generated content before interpolation into mrkdwn strings. Only three characters need escaping: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`.

**Affected files:** All 6 files with mrkdwn text interpolation.

**1B. Section text may exceed 3,000 char limit**

Several blocks concatenate unbounded item lists into a single `section.text`:
- `slack-briefing.ts` — Tier 2 business items (`\n\n` joined), FYI items, news items, work queue
- `morning-briefing/route.ts` — IDS priority list, Ember observations, LLM-generated `brief.brief`

Slack silently truncates section text at 3,000 chars, potentially cutting off content mid-sentence.

**Fix:** Chunk long lists into multiple section blocks (one per item, or batches). Truncate LLM output with a "see more" link. Add a `truncateForSlack(text, maxLen)` utility that truncates at word boundaries.

### Phase 2: Platform Features (Medium Priority)

**2A. Static dates instead of `<!date^>` tokens**

Dates are rendered server-side with `toLocaleString()`/`toLocaleDateString()`. Slack's `<!date^unix^{token}|fallback>` syntax renders dates in each reader's local timezone and 12h/24h preference.

**Fix:** Create `slackDate(date, format, fallback)` utility. Replace static dates in: briefing header, system alert timestamp, pre-call meeting time, nudge "Last Updated" field.

**2B. Link unfurling not suppressed on briefings**

Industry Pulse news items and dashboard links trigger Slack's auto-unfurl preview, making messages visually noisy. Briefings should suppress unfurling.

**Fix:** Add `unfurl_links: false, unfurl_media: false` to `postBlockMessage()` as optional parameters. Pass `true` for briefing and scorecard messages.

**2C. Briefing fallback `text` not informative**

Current fallback: `"Morning Briefing — 2026-03-01"`. Push notifications and search results show only this text — no hint of urgent items.

**Fix:** Build fallback text that summarizes: `"Morning Briefing — Mar 1 | 2 urgent, 3 updates, 4 items for review"`.

### Phase 3: Structural Improvements (Low Priority)

**3A. Button missing `action_id`**

Checkup reminder "Take Assessment" button in `slack.ts` has no `action_id`. Block Kit spec requires it on all interactive elements.

**Fix:** Add `action_id: 'checkup_take_assessment'`.

**3B. Key-value data could use section `fields` layout**

L10 prep renders Scorecard, Rocks, To-Dos, Financial, Pipeline as separate section blocks. A two-column `fields` layout would be more compact and scannable.

**Fix:** Combine related key-value pairs into `fields` arrays where appropriate. Apply to L10 prep and pre-call brief metadata.

**3C. LLM output posted raw without mrkdwn verification**

EA query responses from Claude are posted directly to Slack. The system prompt asks for "Slack markdown formatting" but there's no enforcement — LLM may occasionally output `**bold**` or `[link](url)`.

**Fix:** Add a light `sanitizeForSlackMrkdwn()` post-processor that converts common standard Markdown patterns to mrkdwn equivalents (`**bold**` → `*bold*`, `[text](url)` → `<url|text>`).

## Implementation Approach

### New utility file: `lib/slack-format.ts`

All formatting utilities in one file:

```typescript
// Core escaping
export function escapeSlackMrkdwn(text: string): string

// Date formatting with <!date^> tokens
export function slackDate(date: Date | string, format: string, fallback?: string): string

// Truncate text for section blocks
export function truncateForSlack(text: string, maxLen?: number): string

// Sanitize LLM output for mrkdwn
export function sanitizeForSlackMrkdwn(text: string): string
```

### Modification strategy

1. Create `lib/slack-format.ts` with all utilities
2. Update each file to import and apply utilities — minimal diffs, no behavior changes beyond formatting safety
3. Update `postBlockMessage` signature for unfurl control
4. No database changes, no new API routes, no new dependencies

## Files to Create/Modify

**New:**
- `ember/src/lib/slack-format.ts` — Formatting utilities

**Modified:**
- `ember/src/lib/agents/slack-briefing.ts` — Escape content, chunk sections, improve fallback text, suppress unfurling
- `ember/src/app/api/agents/cron/morning-briefing/route.ts` — Escape content, chunk sections, use `<!date^>`, truncate LLM output
- `ember/src/lib/agents/nudge-engine.ts` — Escape content, use `<!date^>`
- `ember/src/lib/connectors/slack-connector.ts` — Add unfurl params to `postBlockMessage`, use `<!date^>` in system alert
- `ember/src/lib/slack.ts` — Add `action_id` to button, escape periodName
- `ember/src/app/api/agents/cron/scorecard-automation/route.ts` — Escape metric names
- `ember/src/lib/agents/command-executor.ts` — Escape output titles, sanitize LLM responses

## Risk Assessment

- **Low risk** — No new features, no DB changes, no API surface changes
- All changes are additive formatting safety; existing message structure preserved
- Escaping is conservative (only `&`, `<`, `>`) — no risk of over-escaping
- Section chunking may slightly change visual layout but improves reliability
- `<!date^>` is a well-supported Slack feature with `|fallback` for graceful degradation

## Testing Plan

- Manual: Trigger morning briefing pipeline via `/api/agents/test/pipeline?step=all`
- Manual: Trigger scorecard automation via test endpoint
- Manual: Send DM commands to verify command-executor responses
- Verify: Create a rock with `>` and `&` in title, confirm it renders correctly in nudge
- Verify: Briefing with 10+ business items doesn't truncate
- Verify: Dates show in reader's timezone (test with two Slack accounts in different TZ)
