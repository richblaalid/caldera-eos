# Design: Work-Hours Grain Transcript Polling

**Date:** 2026-03-01
**Status:** Approved

## Problem

Grain transcript ingestion runs every 6 hours (`0 */6 * * *`), meaning meetings can take up to 6 hours to appear in Ember's data pipeline. Partners want to act on meeting context shortly after calls end.

## Solution

Increase Grain polling frequency to every 30 minutes during CT work hours on weekdays.

**Cron schedule:** `*/30 14-22 * * 1-5`
- Every 30 minutes, 14:00-22:00 UTC (8 AM - 5 PM CT)
- Weekdays only (Mon-Fri)
- Covers 9 AM - 5 PM CT meeting window with 1-hour buffer on each side

## Changes

1. `vercel.json` — update transcript cron schedule from `0 */6 * * *` to `*/30 14-22 * * 1-5`

No code changes required. The existing route handles empty polls gracefully (returns immediately when no new meetings found).

## Cost

- ~20 invocations/workday (30-min intervals over 10 hours, minus occasional weekend skips)
- Empty polls: 1 Haiku call each (~$0.001)
- Estimated: ~$0.02/day, ~$0.40/month

## Timing Improvement

| Scenario | Before (6h) | After (30min) |
|----------|-------------|---------------|
| Meeting ends 10:00 AM | Ingested 12:00 PM | Ingested ~10:30 AM |
| Meeting ends 2:00 PM | Ingested 6:00 PM | Ingested ~2:30 PM |
| Meeting ends 5:00 PM | Ingested 12:00 AM | Ingested ~5:30 PM |

## Trade-offs

- Grain transcripts are available within minutes of meeting end, so 30-min polling captures them promptly
- No weekend/evening polling avoids wasted API calls
- Google Calendar already polls at `*/15` — transcript polling at `*/30` is consistent but less aggressive since each poll costs a Haiku API call
