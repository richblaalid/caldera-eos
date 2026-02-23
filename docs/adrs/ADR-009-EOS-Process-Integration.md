# ADR-009: EOS Process Integration Model

**Status:** Accepted
**Date:** February 22, 2026
**Decision Makers:** Rich (CEO/Integrator)
**Context:** How agents interact with and reinforce EOS (Entrepreneurial Operating System) processes within Ember

---

## Context

Caldera is in early EOS implementation — still completing the V/TO, with L10 meetings starting within two weeks. The agent system must reinforce EOS adoption rather than compete with it. Agents need to both contribute to EOS processes (generating Issues, tracking Rocks, maintaining Scorecard) and leverage EOS as the operating rhythm that structures their work.

The risk: if agents create a parallel management system outside EOS, it undermines the discipline EOS is designed to build. The opportunity: agents can make EOS adoption faster and stickier by doing the preparatory work that makes EOS ceremonies valuable from day one.

## Decision

**All agent outputs map to EOS constructs.** Agents do not create their own task management, priority systems, or meeting cadences that exist outside of EOS. Instead:

- Strategic insights → **Issues** (with IDS-ready context)
- Metric recommendations → **Scorecard** entries
- Priority recommendations → **Rocks** (proposed for quarterly planning)
- Action items → **To-dos** (7-day cycle)
- Pattern observations → **Issues** or meeting agenda items
- Accountability nudges → tied to existing **Rocks** and **To-dos**

### Agent-to-EOS Mapping

| Agent | Primary EOS Outputs |
|-------|-------------------|
| EA | To-do creation from meeting follow-ups, Rock status reminders, L10 prep aggregation |
| Financial Strategist | Scorecard metrics (financial), Issues when thresholds breached, Rock proposals for financial goals |
| Marketing Strategist | Issues for positioning gaps, Rock proposals for marketing initiatives, To-dos for content tasks |
| BD Strategist | Scorecard metrics (pipeline), Issues for pipeline health, Rock proposals for partnership targets |
| Operations Architect | Issues for process gaps, To-dos for delivery tasks, Rock proposals for process improvements |
| Product Innovation Officer | Issues for product opportunities, Rock proposals for product development sprints |

### Agent-Generated EOS Items Schema

```sql
-- Extension to existing EOS tables, not replacement
ALTER TABLE issues ADD COLUMN IF NOT EXISTS
  generated_by TEXT,                    -- Agent ID that created this
  generation_context JSONB,             -- Why the agent created it, supporting data
  auto_generated BOOLEAN DEFAULT false; -- Flag for filtering in UI

ALTER TABLE todos ADD COLUMN IF NOT EXISTS
  generated_by TEXT,
  generation_context JSONB,
  auto_generated BOOLEAN DEFAULT false;

ALTER TABLE scorecard_metrics ADD COLUMN IF NOT EXISTS
  data_source TEXT,                     -- 'manual', 'quickbooks', 'hubspot', etc.
  auto_populated BOOLEAN DEFAULT false; -- Whether the agent fills this automatically
```

### EOS Ceremony Support

**L10 Weekly Meeting — Agent Preparation:**

| Timing | Action | Agent |
|--------|--------|-------|
| 3 days before | Generate meeting prep document | EA (orchestrating all agents) |
| 3 days before | Update Scorecard with latest available data | Financial Strategist, BD Strategist |
| 2 days before | Prompt Rock owners for status updates via Slack | EA |
| 1 day before | Prioritize Issues list based on urgency and data | EA |
| 1 day before | Surface any new agent-generated Issues for review | All advisors via EA |
| Meeting time | Serve as data reference during meeting (Ember UI) | Ember platform |
| Post-meeting | Extract action items from transcript → To-dos | EA + transcript pipeline |
| Post-meeting | Update Issue statuses based on IDS outcomes | EA |
| Post-meeting | Push meeting summary to Slack | EA |

**Quarterly Planning — Agent Preparation:**

| Timing | Action | Agent |
|--------|--------|-------|
| 2 weeks before | Financial quarter review and projections | Financial Strategist |
| 2 weeks before | Pipeline and revenue forecast for next quarter | BD Strategist + Financial Strategist |
| 1 week before | Each advisor proposes 1-2 Rocks for consideration | All advisors |
| 1 week before | Operations retrospective on delivery quality | Operations Architect |
| 1 week before | Market and competitive landscape brief | Marketing Strategist |
| 1 week before | Product opportunity portfolio review | Product Innovation Officer |
| Planning day | All data compiled into planning package in Ember | EA |

### Proactive Nudge System (EOS Accountability)

The nudge system follows a three-step escalation model aligned with EOS accountability principles:

**Step 1 — Gentle Reminder (automated, Zone 1):**
- Rock milestone approaching → Slack DM to owner: "Your Rock milestone '[X]' is due in 3 days. How's it tracking?"
- Scorecard metric not entered → Slack DM: "Weekly metric '[X]' hasn't been updated yet."
- To-do approaching 7-day deadline → Slack reminder

**Step 2 — Direct Nudge (automated, Zone 1):**
- Rock milestone overdue → Slack DM: "Your Rock milestone '[X]' was due 2 days ago. Do you need help removing a blocker?"
- Scorecard metric consistently missed → "You've missed entering '[X]' for 3 weeks. Should we discuss whether this is the right metric?"
- To-do overdue → "To-do '[X]' is past its 7-day deadline. Should it carry forward or be dropped?"

**Step 3 — L10 Escalation (Zone 2 — surfaces for group discussion):**
- Rock significantly off-track → Creates an Issue: "Rock '[X]' is at risk — [data and context]"
- Pattern of missed Scorecard entries → Creates an Issue: "Scorecard discipline needs discussion — [pattern data]"
- Repeated To-do carryforward → Creates an Issue: "Recurring To-do '[X]' may need to become a Rock or be dropped"

**The "Surface What's Not Being Said" Principle:**
When the system detects patterns like:
- A Rock that's been "on track" for 6 weeks with no milestone progress
- Two partners consistently avoiding discussion of a topic
- Scorecard metrics that are green but trending in the wrong direction
- Client health indicators declining while no Issues have been raised

→ The EA surfaces these as diplomatically-framed Issues with data, not accusations. Example: "Observation: [Client B] margin has declined for 4 consecutive weeks from 38% to 26%, but no Issue has been raised. Should we discuss this at L10?"

## Consequences

**Positive:**
- Agent system reinforces EOS adoption instead of competing with it
- EOS ceremonies become richer because agents do the data prep
- Accountability is data-driven, not personality-driven (reduces interpersonal friction)
- The "surface what's not being said" capability is the most uniquely valuable aspect of Ember
- Partners build the EOS habit faster because the system removes friction from data entry and meeting prep

**Negative:**
- Agents may generate too many Issues, diluting the Issues list — mitigate with quality thresholds and batching
- Automated nudges could feel nagging if poorly tuned — start conservative, adjust based on partner feedback
- Risk of partners relying on agents for Rock updates instead of developing personal accountability — nudges should encourage self-reporting, not replace it

**Design Principle:**
Agents are EOS-native. They think in EOS constructs, speak in EOS language, and output in EOS formats. They are not a project management layer that happens to connect to EOS — they are the intelligent layer that makes EOS work better.
