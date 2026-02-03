# Slack Integration Enhancements Plan

## Overview

Expand Ember's Slack integration beyond checkup reminders to provide proactive notifications, slash commands, interactive messages, AI chat, and L10 meeting support. This creates a seamless EOS experience where team members can interact with Ember directly from Slack.

## Current State

**Already Implemented:**
- Slack OAuth flow with bot token storage
- Channel selection for posting
- Weekly checkup reminders with @mentions
- Auto-matching Slack users to profiles by email

**Slack App Scopes (current):**
- `chat:write` - Post messages
- `users:read` - List users
- `users:read.email` - Match by email
- `channels:read` - List public channels
- `groups:read` - List private channels

## Phase 1: Proactive Reminders (Quick Win)

### Goal
Send timely reminders for rocks, to-dos, scorecard, and L10 meetings via DM or channel.

### New Slack Scopes Required
- `im:write` - Send DMs to users

### Database Changes

**New table: `slack_reminder_settings`**
```sql
CREATE TABLE slack_reminder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  reminder_type TEXT NOT NULL, -- 'rock_milestone', 'todo_daily', 'scorecard_weekly', 'l10_meeting'
  is_enabled BOOLEAN DEFAULT true,
  delivery_method TEXT DEFAULT 'dm', -- 'dm' or 'channel'
  channel_id TEXT, -- if delivery_method = 'channel'
  schedule_time TIME DEFAULT '09:00',
  schedule_days TEXT[] DEFAULT ARRAY['monday'], -- days of week
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Cron Jobs

| Cron | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/rock-reminders` | Daily 9 AM | Milestones due in 3 days |
| `/api/cron/todo-reminders` | Daily 8 AM | Open to-dos for the day |
| `/api/cron/scorecard-reminders` | Friday 4 PM | Weekly metric entry reminder |
| `/api/cron/l10-reminders` | 1 hour before | L10 meeting starting soon |

### Message Templates

**Rock Milestone Reminder (DM):**
```
:mountain: Rock Milestone Reminder

Your rock "Launch new website" has a milestone due in 3 days:
• Complete design review

[View Rock] button
```

**To-Do Daily Digest (DM):**
```
:white_check_mark: Good morning! Here are your to-dos for today:

• Follow up with client (due today)
• Review Q1 numbers (overdue - 2 days)
• Prep L10 agenda

[View All To-dos] button
```

**Scorecard Reminder (Channel):**
```
:bar_chart: Weekly Scorecard Reminder

Time to enter this week's metrics!

Pending: @Rich @John @Wade

[Enter Scorecard] button
```

### Implementation Tasks

- [ ] Add `im:write` scope to Slack app
- [ ] Create `slack_reminder_settings` table and migration
- [ ] Add reminder settings UI to `/dashboard/settings/slack`
- [ ] Implement `/api/cron/rock-reminders` with milestone logic
- [ ] Implement `/api/cron/todo-reminders` with daily digest
- [ ] Implement `/api/cron/scorecard-reminders` for weekly entry
- [ ] Add DM sending function to `/lib/slack.ts`
- [ ] Create message block builders for each reminder type
- [ ] Add vercel.json cron entries

### Files to Create/Modify

**New files:**
- `ember/src/app/api/cron/rock-reminders/route.ts`
- `ember/src/app/api/cron/todo-reminders/route.ts`
- `ember/src/app/api/cron/scorecard-reminders/route.ts`
- `ember/supabase/migrations/008_slack_reminder_settings.sql`

**Modified files:**
- `ember/src/lib/slack.ts` - Add DM function, new block builders
- `ember/src/app/dashboard/settings/slack/page.tsx` - Reminder settings
- `ember/vercel.json` - New cron entries

---

## Phase 2: Daily/Weekly Digests

### Goal
Send comprehensive status digests summarizing EOS health.

### Message Templates

**Morning Digest (DM - Daily 8 AM):**
```
:sunrise: Good morning, Rich! Here's your EOS snapshot:

*To-dos*
• 3 due today, 1 overdue

*Rocks at Risk*
• "Launch website" - milestone overdue

*Upcoming*
• L10 meeting in 2 days

[Open Dashboard] button
```

**Weekly Summary (Channel - Monday 9 AM):**
```
:calendar: Weekly EOS Summary

*Rocks Progress*
• 5/8 on track, 2 at risk, 1 off track

*Scorecard*
• 12/15 metrics hit target last week

*Issues*
• 3 new, 5 resolved, 8 active

*Checkup*
• Q1 Assessment: 2/3 completed

[View Full Report] button
```

### Implementation Tasks

- [ ] Create digest data aggregation functions in `/lib/eos/digest.ts`
- [ ] Implement `/api/cron/morning-digest` for daily personal summary
- [ ] Implement `/api/cron/weekly-summary` for team channel
- [ ] Build digest message block templates
- [ ] Add digest toggle to reminder settings UI

---

## Phase 3: Slash Commands (Medium Effort)

### Goal
Allow users to query and update EOS data directly from Slack.

### New Slack Configuration Required
- Enable Slash Commands in Slack app
- Set Request URL to `/api/slack/commands`
- Add `commands` scope

### Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/ember rocks` | Show your rock statuses | Lists active rocks with status |
| `/ember todos` | Show open to-dos | Lists to-dos due this week |
| `/ember issue <text>` | Quick-log an issue | Creates issue in backlog |
| `/ember scorecard` | This week's metrics | Shows your scorecard entries |
| `/ember help` | Show available commands | Lists all commands |

### API Route

**`/api/slack/commands/route.ts`**
- Verify Slack request signature
- Parse command and arguments
- Route to appropriate handler
- Return Slack message response

### Implementation Tasks

- [ ] Enable Slash Commands in Slack app config
- [ ] Add `commands` scope
- [ ] Create `/api/slack/commands/route.ts` with signature verification
- [ ] Implement `/ember rocks` - query rocks by user
- [ ] Implement `/ember todos` - query todos by user
- [ ] Implement `/ember issue` - create issue via API
- [ ] Implement `/ember scorecard` - query this week's entries
- [ ] Implement `/ember help` - return command list
- [ ] Add rate limiting and error handling

### Files to Create

- `ember/src/app/api/slack/commands/route.ts`
- `ember/src/lib/slack/commands.ts` - Command handlers
- `ember/src/lib/slack/verify.ts` - Request signature verification

---

## Phase 4: Interactive Messages

### Goal
Enable actions directly from Slack messages (mark complete, update status).

### New Slack Configuration Required
- Enable Interactivity in Slack app
- Set Request URL to `/api/slack/interactions`

### Interactions

| Action | Context | Result |
|--------|---------|--------|
| Mark To-do Complete | To-do reminder | Updates to-do status |
| Update Rock Status | Rock reminder | Opens modal to change status |
| Log Issue | Any message | Opens issue creation modal |
| Snooze Reminder | Any reminder | Reschedules for later |

### API Route

**`/api/slack/interactions/route.ts`**
- Handle button clicks (block_actions)
- Handle modal submissions (view_submission)
- Update Ember database
- Send confirmation message

### Message Actions

Add buttons to existing reminder messages:
```
[Mark Complete] [Snooze 1 hour] [View in Ember]
```

### Implementation Tasks

- [ ] Enable Interactivity in Slack app config
- [ ] Create `/api/slack/interactions/route.ts`
- [ ] Add action buttons to reminder block builders
- [ ] Implement "Mark Complete" for to-dos
- [ ] Implement "Update Status" modal for rocks
- [ ] Implement "Log Issue" modal
- [ ] Implement "Snooze" functionality
- [ ] Update message after action (replace or thread reply)

### Files to Create

- `ember/src/app/api/slack/interactions/route.ts`
- `ember/src/lib/slack/interactions.ts` - Interaction handlers
- `ember/src/lib/slack/modals.ts` - Modal view builders

---

## Phase 5: Ember AI in Slack (Higher Effort)

### Goal
Chat with Ember AI directly in Slack for EOS coaching and transcript queries.

### Approach Options

**Option A: App Mentions**
- User mentions @Ember in channel
- Bot receives event and responds in thread
- Requires: `app_mentions:read` scope, Events API

**Option B: Direct Messages**
- User DMs the Ember bot
- More private, personal coaching
- Requires: `im:history`, `im:read` scopes, Events API

**Recommended: Option B (DMs) for coaching, Option A for team questions**

### New Slack Configuration Required
- Enable Events API
- Subscribe to: `app_mention`, `message.im`
- Add scopes: `app_mentions:read`, `im:history`, `im:read`

### API Route

**`/api/slack/events/route.ts`**
- Handle Slack URL verification challenge
- Process `app_mention` events
- Process `message.im` events
- Call Claude API with context
- Post response back to Slack

### Context Injection
When user asks a question:
1. Identify user from Slack ID
2. Fetch relevant EOS context (their rocks, recent transcripts)
3. Build Claude prompt with Ember persona
4. Stream response to Slack thread

### Example Interactions

**In DM:**
```
User: What should I focus on this week?

Ember: Based on your current situation:

*Rocks*
Your "Launch website" rock has a milestone due Friday.
I'd prioritize the design review today.

*To-dos*
You have 2 overdue items - the client follow-up
seems time-sensitive.

*L10 Prep*
Your L10 is Thursday. Consider what issues to raise.
```

**In Channel (mention):**
```
User: @Ember what did we decide about pricing?

Ember: From your L10 on Jan 15th:

You discussed the pricing tier structure and decided to:
• Keep 3 tiers (Starter, Pro, Enterprise)
• Raise Pro tier by 15%
• Add annual discount option

This was logged as a to-do for @John to implement.
```

### Implementation Tasks

- [ ] Enable Events API in Slack app
- [ ] Add required event subscriptions
- [ ] Create `/api/slack/events/route.ts` with URL verification
- [ ] Implement event routing (mention vs DM)
- [ ] Build context aggregation (rocks, todos, transcripts)
- [ ] Integrate Claude API with Ember persona
- [ ] Handle streaming responses to Slack
- [ ] Add conversation threading
- [ ] Implement rate limiting per user

### Files to Create

- `ember/src/app/api/slack/events/route.ts`
- `ember/src/lib/slack/events.ts` - Event handlers
- `ember/src/lib/slack/ai.ts` - Claude integration for Slack
- `ember/src/lib/eos/context.ts` - Context aggregation

---

## Phase 6: L10 Meeting Flow

### Goal
Facilitate L10 meetings through Slack with real-time updates.

### Commands

| Command | Description |
|---------|-------------|
| `/ember start-l10` | Begin L10, post agenda to channel |
| `/ember segue` | Post random segue question |
| `/ember issue <text>` | Log issue during meeting |
| `/ember end-l10` | Post meeting summary |

### Meeting Flow

**Start L10:**
```
:fire: L10 Meeting Started

*Segue:* What's one personal best from this week?

*Agenda:*
• Scorecard Review (5 min)
• Rock Review (5 min)
• Customer/Employee Headlines (5 min)
• To-Do List (5 min)
• IDS (60 min)
• Conclude (5 min)

[Log Issue] [Add To-do] [End Meeting]
```

**End L10:**
```
:checkered_flag: L10 Meeting Complete

*Duration:* 87 minutes

*Issues Discussed:* 4
• Resolved: 2
• Moved to next week: 2

*New To-dos:* 6

*Scorecard:*
• 12/15 metrics on track

[View Full Summary]
```

### Implementation Tasks

- [ ] Add `/ember start-l10` command
- [ ] Create L10 session state management
- [ ] Post segue question from curated list
- [ ] Track issues logged during meeting
- [ ] Implement `/ember end-l10` with summary
- [ ] Add meeting duration tracking
- [ ] Create meeting summary block template

---

## Phase 7: Real-time Updates Channel

### Goal
Keep team informed with a dedicated #eos-updates channel.

### Events to Post

| Event | Message |
|-------|---------|
| Rock status change | ":mountain: Rock 'Website Launch' moved to At Risk by @Rich" |
| Issue created | ":exclamation: New issue: 'Customer churn increasing'" |
| Issue resolved | ":white_check_mark: Issue resolved: 'API latency'" |
| To-do completed | ":ballot_box_with_check: @Rich completed 'Review Q1 numbers'" |
| Checkup completed | ":chart_with_upwards_trend: @Wade completed Q1 Checkup (Score: 78)" |

### Implementation

Add Slack notification triggers to existing API routes:
- `POST /api/eos/rocks` - On status change
- `POST /api/eos/issues` - On create/resolve
- `PUT /api/eos/todos` - On complete
- `POST /api/eos/checkup/completions` - On submit

### Implementation Tasks

- [ ] Add `updates_channel_id` to `slack_settings`
- [ ] Create `postUpdate()` function in `/lib/slack.ts`
- [ ] Add notification calls to rocks API
- [ ] Add notification calls to issues API
- [ ] Add notification calls to todos API
- [ ] Add notification calls to checkup completions
- [ ] Add channel selector to Slack settings page
- [ ] Make notifications configurable (which events to post)

---

## Priority Recommendation

| Phase | Priority | Effort | Value | Recommendation |
|-------|----------|--------|-------|----------------|
| 1. Proactive Reminders | High | Medium | High | Do first - extends existing patterns |
| 2. Daily/Weekly Digests | High | Low | High | Quick win after Phase 1 |
| 7. Updates Channel | Medium | Low | Medium | Easy add-on to existing APIs |
| 3. Slash Commands | Medium | Medium | High | Good UX improvement |
| 4. Interactive Messages | Medium | Medium | High | Builds on slash commands |
| 6. L10 Meeting Flow | Medium | High | Medium | Nice-to-have for power users |
| 5. Ember AI in Slack | Low | High | High | Complex, save for later |

## Slack App Configuration Summary

### Current Scopes
- `chat:write`
- `users:read`
- `users:read.email`
- `channels:read`
- `groups:read`

### Additional Scopes Needed (by phase)

| Phase | Scopes |
|-------|--------|
| 1 | `im:write` |
| 3 | `commands` |
| 5 | `app_mentions:read`, `im:history`, `im:read` |

### Features to Enable

| Phase | Feature | Configuration |
|-------|---------|---------------|
| 3 | Slash Commands | Request URL: `/api/slack/commands` |
| 4 | Interactivity | Request URL: `/api/slack/interactions` |
| 5 | Events API | Request URL: `/api/slack/events` |

---

## Success Metrics

- **Engagement**: % of team using Slack features weekly
- **Response Time**: Time from notification to action
- **Adoption**: Number of slash commands used per week
- **Completion Rate**: To-dos marked complete from Slack vs web
- **User Satisfaction**: Qualitative feedback from team
