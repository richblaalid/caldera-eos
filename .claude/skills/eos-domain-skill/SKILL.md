# EOS Domain Knowledge
## Skill for Building Ember — The AI-Powered EOS Integrator

---

## When to Use This Skill

Activate this skill when working on any Ember feature involving:
- Rocks, Scorecard, Issues, To-Dos
- L10 Meetings, Quarterly Meetings, Annual Planning
- V/TO (Vision/Traction Organizer)
- People Component (Accountability Chart, GWC, People Analyzer)
- Process Component (Core Processes, FBA)
- Meeting transcript parsing or classification
- Ember's coaching chat or persona prompts
- EOS-related validation logic or data models

---

## File Reference (Read in This Order)

### 1. `eos-rules-reference.md` — Validation & Constraints
The canonical business rules from *Traction*. **Read this first** for any implementation work.

Contains:
- Entity constraints (Rocks: 3-7, To-Dos: 7 days, Scorecard: 5-15 metrics)
- Status values and transitions (on track / off track, done / not done)
- L10 meeting structure (90 min, segment time allocations)
- IDS process rules (priority order, no tangents)
- Quarterly and annual meeting agendas

### 2. `eos-glossary.md` — Classification & Detection
Term definitions, synonyms, and classification rules for AI processing.

Contains:
- How to distinguish Rock vs To-Do vs Issue
- Meeting segment indicators for transcript parsing
- Anti-patterns Ember should flag
- Status value definitions
- NER hints and intent classification guidance

### 3. `chapters/` — Deep Context (RAG Source)
Full chapter content from *Traction*, organized by EOS component.

Use for:
- RAG knowledge base for Ember's coaching chat
- "Why" explanations when users ask about EOS rules
- Ember persona grounding and voice
- Onboarding content and teaching moments

| File | Component | Key Content |
|------|-----------|-------------|
| `00-introduction.md` | Overview | Why EOS, who it's for |
| `01-entrepreneurial-operating-system.md` | All Six | Component overview |
| `02-letting-go-of-the-vine.md` | Mindset | Leadership prerequisites |
| `03-the-vision-component.md` | Vision | V/TO, Core Values, 10-Year Target, Marketing Strategy |
| `04-the-people-component.md` | People | Accountability Chart, GWC, People Analyzer |
| `05-the-data-component.md` | Data | Scorecard, measurables, leading indicators |
| `06-the-issues-component.md` | Issues | Issues List, IDS process |
| `07-the-process-component.md` | Process | Core processes, 20/80 rule, FBA |
| `08-the-traction-component.md` | Traction | Rocks, L10, Quarterly Meeting, Meeting Pulse |
| `09-pulling-it-all-together.md` | Integration | How components work together |
| `10-getting-started.md` | Implementation | Onboarding sequence |

---

## About Ember

Ember is Caldera's AI-powered EOS Integrator — a "fourth partner" for the leadership team.

**Core functions:**
- Track V/TO, Rocks, Scorecard, Issues, To-Dos
- Ingest meeting transcripts → extract EOS entities
- Generate L10 prep and quarterly review summaries
- Coach via chat with canonical EOS guidance
- Surface patterns and anti-patterns across time

**Persona:** Warm but direct. Willing to hold the team accountable. Not a passive dashboard — an active participant grounded in Wickman's methodology.

---

## About Caldera

Three-partner remote software agency (~15 people, ~3 years old).

**Rich** — Integrator, Head of Finance. Building Ember. Product/systems thinker.
**Wade** — Head of Ops/Delivery, CTO-track. Technical pragmatist, calm communicator.
**John** — Head of Sales. Relationship builder, wants something to believe in.

**Key context:**
- No Visionary title assigned yet (deliberate — team building trust first)
- Rich carries too many seats currently
- Partners recently had breakthrough on radical transparency
- Team beyond partners is "happy enough" but not yet proud of Caldera identity

---

## Key Rules (Quick Reference)

### Rocks
- 3-7 per company and per leadership team member
- 1-3 for all other employees
- 90-day duration, aligned to quarter ends
- One owner per Rock (never shared)
- Must be specific, measurable, attainable
- No new Rocks mid-quarter
- Target 80% completion rate

### Scorecard
- 5-15 metrics for leadership
- Every metric has a goal and one owner
- Reviewed weekly: "on track" or "off track" only
- Off track → drop to Issues List, no discussion

### To-Dos
- 7-day action items
- "Done" or "not done" weekly
- Should not persist more than 2 weeks
- 90% completion target per week

### L10 Meeting (90 min hard stop)
| Segment | Time |
|---------|------|
| Segue | 5 min |
| Scorecard | 5 min |
| Rock Review | 5 min |
| Headlines | 5 min |
| To-Do List | 5 min |
| IDS | 60 min |
| Conclude | 5 min |

### IDS Process
1. **Identify** the real, root-cause issue
2. **Discuss** openly — all perspectives, no tangents
3. **Solve** decisively — create to-dos

Always solve by priority order. Identify top 3 first, then solve #1 before #2.

---

## Common Implementation Patterns

### "Drop It Down"
Off-track Scorecard metric or Rock during review → auto-create Issue → surface in IDS. No discussion during reporting phase.

### The 80% Rule
Target 80% Rock completion, not 100%. Below 80% triggers root cause discussion. At 80%+ = success.

### Priority-Based IDS
Issues aren't solved top-to-bottom. Team identifies top 3 by priority, solves #1 completely first. Solving #1 often resolves other issues that were symptoms.

### No New Rocks Mid-Quarter
Hard constraint. New ideas → V/TO Issues List for next quarter. Ember enforces this.

### The 90-Day World
Everything operates in 90-day cycles. Rocks, quarterlies, V/TO reviews. Design all time-based features around this rhythm.

---

## Ember Persona Guidelines

When writing AI prompts or coaching responses:

1. **Use EOS terminology:** "Rock" not "goal," "Scorecard" not "dashboard," "IDS" not "brainstorm"

2. **Reference rules when pushing back:**
   > "EOS recommends 3-7 Rocks per person — you've listed 9. Which two could move to the V/TO Issues List?"

3. **Ask coaching questions, don't command:**
   > "This Rock doesn't have a measurable outcome — how will you know at quarter end whether it's done?"

4. **Surface patterns across time:**
   > "This is the third quarter utilization has been off track. Is there a structural issue we should IDS?"

5. **Be direct, not soft:** Ember is a "fourth partner," not a passive tool. Warm but honest.

---

## Data Model Guidance

**Rocks:** title, owner (one), due_date (quarter end), status (on_track / off_track / done / not_done), quarter_id

**To-Dos:** task, assignee (one), due_date (7 days from creation), status (done / not_done), source_issue_id

**Issues:** title, raised_by, date_raised, priority, discussion_summary, resolution_type (solved / to_do_created / moved_to_vto / carried_forward), linked_todo_ids

**Scorecard Entries:** metric_id, week_ending, value (numeric), goal (numeric), status (on_track / off_track), owner

**L10 Meetings:** date, attendees, segment_timestamps, rating (1-10), todos_created[], issues_resolved[]
