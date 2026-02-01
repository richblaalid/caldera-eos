# EOS Organizational Checkup Feature Plan

## Overview

Add the EOS Organizational Checkup - a 20-question assessment (rated 1-5) covering the 6 EOS components. Team members complete individually, with baseline + quarterly recurring assessments. Includes Slack reminders and completion tracking.

## Database Schema

### New Tables

**Migration:** `ember/supabase/migrations/007_create_checkup_tables.sql`

| Table | Purpose |
|-------|---------|
| `checkup_periods` | Assessment windows (Q1 Baseline, Q2 Assessment, etc.) |
| `checkup_questions` | 20 static EOS questions with component grouping |
| `checkup_responses` | Per-user answers (score 1-5, optional notes) |
| `checkup_completions` | Tracks who completed with total/component scores |
| `slack_settings` | Org-level Slack configuration |

**Key constraints:**
- `checkup_responses`: UNIQUE(period_id, user_id, question_id)
- `checkup_completions`: UNIQUE(period_id, user_id)
- All tables use existing RLS pattern with `organization_id`

### The 20 Questions (by Component)

| Component | Questions | Max Score |
|-----------|-----------|-----------|
| Vision | 3 questions | 15 |
| People | 4 questions | 20 |
| Data | 3 questions | 15 |
| Issues | 3 questions | 15 |
| Process | 3 questions | 15 |
| Traction | 4 questions | 20 |
| **Total** | **20** | **100** |

## API Routes

| Route | Purpose |
|-------|---------|
| `GET/POST /api/eos/checkup/periods` | List/create assessment periods |
| `GET/PUT /api/eos/checkup/responses` | Get/save user responses (batch upsert) |
| `GET/POST /api/eos/checkup/completions` | Track completions |
| `GET /api/eos/checkup/stats` | Team averages, trends |
| `GET /api/cron/checkup-reminders` | Vercel cron for Slack reminders |

## UI Pages

### Navigation
Add to Sidebar after "Scorecard":
```
Checkup - EOS health assessment
```

### Pages

| Page | Path | Features |
|------|------|----------|
| **Dashboard** | `/dashboard/checkup` | Current period status, team progress, score history chart |
| **Take Assessment** | `/dashboard/checkup/assess` | 20 questions grouped by component, auto-save, progress indicator |
| **Results** | `/dashboard/checkup/[periodId]` | Individual vs team scores, component breakdown |
| **Admin** | `/dashboard/checkup/admin` | Create periods, view who completed |

### Assessment UX
- Questions grouped into 6 collapsible sections by component
- Radio buttons 1-5 for each question
- Optional notes field per question
- Auto-save with debounce (1500ms) following VTO edit pattern
- Progress indicator (12/20 answered)
- Submit button to finalize (requires all 20 answered)

## Slack Integration

### Approach: Full Slack App with OAuth
Build a proper Slack app that allows @mentioning specific users who haven't completed.

**Setup Required:**
1. Create Slack app in api.slack.com
2. Configure OAuth scopes: `chat:write`, `users:read`
3. Add OAuth redirect URL to app settings
4. Store bot token securely in database

**Database additions to `slack_settings`:**
- `bot_token` - OAuth access token
- `channel_id` - Leadership channel to post reminders
- `is_active` - Enable/disable integration

**Profile mapping:**
- Add `slack_user_id` column to `profiles` table
- Map during OAuth flow or manual entry
- Enables @mentions in reminders

### Reminder Schedule
- Vercel cron runs Monday 9 AM during active periods
- Posts to configured leadership channel
- @mentions specific users who haven't completed
- Direct CTA button to assessment page

### Message Format
```
:fire: EOS Organizational Checkup Reminder

Q1 2025 Assessment is open.

Pending: @Rich @John @Wade

[Take Assessment] button
```

### OAuth Flow
1. Admin clicks "Connect Slack" in Ember settings
2. Redirect to Slack OAuth consent
3. Callback stores bot token in `slack_settings`
4. Admin selects channel for reminders

## Implementation Phases

### Phase 1: Database (2 hours) ✅
- [x] Create migration `007_create_checkup_tables.sql`
- [x] Add RLS policies following existing patterns
- [x] Seed 20 questions
- [x] Add TypeScript types to `database.ts`

### Phase 2: Backend API (3 hours) ✅
- [x] Create `/lib/eos/checkup.ts` with CRUD functions
- [x] Implement API routes for periods, responses, completions
- [x] Add stats endpoint for team averages

### Phase 3: Core UI (4 hours) ✅
- [x] Add Checkup to Sidebar navigation
- [x] Build Dashboard page (current status, history)
- [x] Build Assessment page with auto-save
- [x] Build Results page with score visualization

### Phase 4: Admin & Tracking (2 hours) ✅
- [x] Build Admin page for period management
- [x] Add completion status tracking
- [x] "Who completed" view

### Phase 5: Slack Integration (4 hours)
- [ ] Create Slack app at api.slack.com
- [x] Add `slack_user_id` to profiles table (in migration)
- [ ] Build OAuth flow (`/api/integrations/slack/oauth`)
- [ ] Build Slack settings page with channel selector
- [ ] Create `/lib/slack.ts` with Web API client
- [ ] Implement reminder cron job with @mentions
- [ ] Test end-to-end notifications

## Key Files to Create/Modify

**New files:**
- `ember/supabase/migrations/007_create_checkup_tables.sql`
- `ember/src/lib/eos/checkup.ts`
- `ember/src/lib/slack.ts`
- `ember/src/app/dashboard/checkup/page.tsx`
- `ember/src/app/dashboard/checkup/assess/page.tsx`
- `ember/src/app/dashboard/checkup/[periodId]/page.tsx`
- `ember/src/app/dashboard/checkup/admin/page.tsx`
- `ember/src/app/dashboard/settings/slack/page.tsx`
- `ember/src/app/api/eos/checkup/*/route.ts` (periods, responses, completions, stats)
- `ember/src/app/api/cron/checkup-reminders/route.ts`
- `ember/src/app/api/integrations/slack/oauth/route.ts`
- `ember/src/app/api/integrations/slack/callback/route.ts`

**Modified files:**
- `ember/src/types/database.ts` - Add checkup + slack types
- `ember/src/components/dashboard/Sidebar.tsx` - Add Checkup nav item
- `ember/vercel.json` - Add checkup-reminders cron
- `ember/supabase/migrations/007_*` - Add slack_user_id to profiles

## Verification

### Testing Plan
1. Create a test assessment period via Admin page
2. Complete assessment as one user - verify auto-save works
3. Check Dashboard shows completion status
4. Complete as second user - verify team averages calculate
5. Trigger cron manually - verify Slack message posts
6. View Results page - verify individual vs team comparison

### Success Criteria
- [ ] All 3 team members can complete assessments independently
- [ ] Scores calculate correctly (component + total)
- [ ] Team averages display correctly
- [ ] Slack reminders post with pending user list
- [ ] Historical trends visible across periods
