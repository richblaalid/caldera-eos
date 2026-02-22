# ADR-007: Slack-First Interaction Model

**Status:** Accepted
**Date:** February 22, 2026
**Decision Makers:** Rich (CEO/Integrator)
**Context:** Defining Slack as the primary interaction surface for the agent system, with Ember as the deep-work fallback

---

## Context

The agent system needs an interaction model that works for three partners with very different relationships to technology. Rich is a power user comfortable with complex tools. John is relational and won't adopt systems that require proactive management. Wade is a builder who will engage deeply but needs the system to meet him where he is.

Slack is already the team's primary communication tool. Ember is a web application that requires deliberate navigation. The choice of primary interface determines adoption success — especially for John.

### Options Considered

**Option A: Ember-First**
All agent interactions happen in Ember's web UI. Slack is used only for simple notifications. Partners must log into Ember to see briefings, approve actions, and interact with agents.

**Option B: Slack-First (Selected)**
All routine interactions happen in Slack. Briefings, approvals, alerts, and quick commands are Slack-native. Ember is reserved for deep work: detailed analysis, document review, L10 facilitation, and configuration.

**Option C: Email-First**
Morning briefings and approvals via email. Familiar but too slow for iterative interactions and doesn't support the conversational command pattern.

## Decision

**Option B — Slack-First** with Ember as the deep-work layer.

### Slack Channel Architecture

```
PRIVATE CHANNELS (per partner):
  #ember-rich        Rich's EA briefings, approval queue, personal alerts
  #ember-john        John's EA briefings, sales prep, follow-up reminders
  #ember-wade        Wade's EA briefings, engineering context, delivery alerts

SHARED CHANNELS:
  #ember-insights    Cross-cutting insights visible to all partners
  #eos-pulse         EOS accountability: Rock reminders, Scorecard nudges, To-do tracking
  #ember-system      System health, error alerts, operational notifications (Rich only)
```

### Message Formats

**Morning Briefing (Rich's channel):**
```
☀️ Good morning, Rich. Here's your February 24 briefing.

🔴 URGENT
1. [AR] Invoice #1847 for [Client] is 47 days overdue ($24,500) — follow up today
2. [EOS] Q1 Rock "Launch fixed-fee pilot" milestone due Friday — you haven't updated status

📋 YOUR DAY
• 9:00 AM — L10 Weekly (prep ready → View in Ember)
• 11:00 AM — [Prospect] Discovery Call (John leading, brief attached)
• 2:00 PM — Wade 1:1

📊 ACROSS THE BUSINESS
Finance: Cash runway healthy at 14 weeks. Margin on [Client B] dropped to 26% — Issue drafted for L10 → [3: Approve Issue]
Sales: 2 deals in pipeline worth $180K combined. John has follow-up due on [Prospect] → auto-reminded
Operations: SOW draft ready for [New Project] based on Thursday's call → [4: Review SOW]
Marketing: Competitor [X] launched AI consulting practice this week → [5: See Analysis]

🤖 AGENT WORK QUEUE
[3] Financial Strategist drafted L10 Issue: "[Client B] Margin Below Threshold" → approve / edit / reject
[4] Ops Architect drafted SOW for [New Project] → review in Ember / approve / reject
[5] Marketing Strategist prepared competitive brief → view in Ember

📰 INDUSTRY INTEL
• "The End of Hourly Billing" — relevant article on value-based pricing in tech services (2 min read)
• [Competitor Y] raised Series B, expanding into AI implementation services
• Gartner: 60% of mid-market companies plan AI transformation consulting in 2026

Reply with item numbers and commands: approve 3, defer 4 to wednesday, dig deeper 5
```

**Approval Interaction:**
```
Rich: approve 3, review 4 later today, have marketing expand on competitor Y's strategy

Ember EA: ✅ Done. Here's what I did:
• Item 3: L10 Issue "[Client B] Margin Below Threshold" added to this week's Issues list
• Item 4: SOW review deferred — I'll resurface at 1:00 PM today
• Item 5: Marketing Strategist is expanding analysis on [Competitor Y] — expect update by EOD

Anything else before your 9:00 AM L10?
```

**John's Sales Prep Push:**
```
📞 Heads up, John — you have a call with [Prospect] at 11:00 AM.

ABOUT THEM:
• Series B fintech, 120 employees, NYC-based
• Looking for mobile app modernization + AI feature integration
• CTO [Name] attended our webinar in January
• They're also talking to [Competitor X] (per LinkedIn activity)

RECOMMENDED APPROACH:
• Lead with our AI consultation + product strategy angle, not just dev capacity
• Their CTO cares about speed-to-market — emphasize our fixed-fee delivery model
• Potential deal size: $150-250K based on similar engagements

KEY TALKING POINTS:
• Ask about their current AI tooling and team capabilities
• Our "build + enable" model vs. pure staff augmentation
• Reference [Similar Client] case study for credibility

Post-call: I'll draft follow-up action items from the Grain transcript. Just take the call. 👍
```

### Natural Language Command Processing

The EA parses Slack replies using Claude with a focused command-extraction prompt. Supported command patterns:

| Pattern | Action |
|---------|--------|
| `approve [N]` / `approve [N] and [N]` | Approve items from briefing |
| `reject [N]` / `reject [N] — [reason]` | Reject with optional reason |
| `defer [N] to [day/date]` | Reschedule item |
| `defer [N]` (no date) | Push to next briefing |
| `review [N] later` / `review [N] at [time]` | Re-surface at specified time |
| `I'll handle [N]` / `taking [N]` | Mark as self-assigned, remove from agent queue |
| `have [agent] [action]` | Route request to specific agent |
| `dig deeper on [N]` / `expand [N]` | Request more detail from originating agent |
| `what's the status of [topic]` | Ad-hoc query routed to relevant agent |
| Free-form question | Route to most relevant agent via intent classification |

### Ember Deep Links

When Slack message references something that needs detailed review, it includes a deep link:

```
→ View in Ember: https://ember.caldera.dev/issues/draft/abc123
→ Review SOW: https://ember.caldera.dev/documents/sow-draft/def456
→ See full analysis: https://ember.caldera.dev/insights/financial/ghi789
```

These links open directly to the relevant content in Ember with full context.

## Consequences

**Positive:**
- Lowest friction interaction model — partners are already in Slack all day
- John adoption problem solved: everything comes to him, he doesn't go to anything
- Natural language commands feel like talking to a real chief of staff
- Approval workflow is lightweight: reply to a message vs. logging into a dashboard
- Rich can manage his entire morning prioritization from his phone in Slack

**Negative:**
- Slack messages have formatting limitations compared to Ember UI
- Long briefings may feel overwhelming in Slack — mitigate by keeping each tier concise with expand-on-demand
- Slack DMs don't support complex interactions (drag-and-drop, rich tables) — deep links to Ember bridge this gap
- Slack API rate limits may constrain message frequency — batch notifications where possible

**Technical Requirements:**
- Slack app must support: reading messages, posting messages, threading, reactions, DMs, slash commands
- Slack Events API subscription for real-time reply processing
- Robust Slack message formatting (Block Kit for structured layouts)
- Session state management: EA must track conversation context within Slack threads
