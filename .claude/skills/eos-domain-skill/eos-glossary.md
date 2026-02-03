# EOS Glossary & Classification Taxonomy
## For Ember AI Processing — Term Definitions, Synonyms, and Classification Rules

Use this glossary when building NER, intent classification, or transcript parsing logic for Ember.

---

## Core EOS Terms

### Rock
- **Definition:** A 90-day strategic priority for the company or individual
- **Synonyms/Signals:** "quarterly priority," "90-day goal," "big priority," "our Rock for this quarter"
- **NOT a Rock:** Day-to-day tasks, client deliverables (those are "business as usual"), open-ended initiatives
- **Classification Rule:** If the timeframe is ~90 days AND it's a discrete, completable objective → Rock. If <7 days → To-Do. If ongoing → Process or Measurable.

### To-Do
- **Definition:** A 7-day action item with a specific owner
- **Synonyms/Signals:** "action item," "I'll do that by next week," "let me handle that," "I'll follow up on..."
- **Classification Rule:** Must be completable within 7 days. If it implies a longer timeframe → suggest Rock or Project. If it's a recurring task → Measurable.

### Issue
- **Definition:** Any obstacle, idea, or concern that needs to be addressed
- **Synonyms/Signals:** "we need to talk about," "the problem is," "I'm concerned about," "we should discuss," "that's an issue"
- **NOT an Issue:** General complaining without intent to solve. Only classify as Issue if the speaker seeks resolution or uses the word explicitly.
- **Classification Rule:** If someone raises a problem AND seeks a solution → Issue. If someone vents without solution intent → note but don't classify.

### Scorecard / Measurable
- **Definition:** A weekly metric with a specific goal number
- **Synonyms/Signals:** "our numbers," "the metric," "utilization rate," "pipeline value," "conversion rate," "KPI"
- **Classification Rule:** Must be numeric, trackable weekly, and have a goal. If it can't be measured weekly → not a Scorecard metric.

### IDS (Identify, Discuss, Solve)
- **Definition:** The three-step process for solving issues
- **Phase indicators:**
  - Identify: "the real issue is," "the root cause," "what's really going on"
  - Discuss: "what do you think," "I see it differently," "have we considered"
  - Solve: "let's do this," "the plan is," "who's going to," "action item"
- **Tangent signals:** Topic drift, storytelling, rehashing known information → flag for facilitator

### V/TO (Vision/Traction Organizer)
- **Definition:** The two-page strategic document containing the 8 questions
- **Synonyms:** "the vision," "our V/TO," "the organizer"

### Core Values
- **Definition:** 3-7 values that define the organization's culture and serve as hiring/firing criteria
- **Classification Rule:** Must be behavioral (observable), not aspirational platitudes

### Core Focus
- **Definition:** The intersection of Purpose/Cause/Passion and Niche
- **Synonyms:** "our sweet spot," "what we do best," "why we exist"

### 10-Year Target
- **Definition:** One big, hairy, audacious goal
- **Synonyms:** "BHAG," "long-term vision," "where we're headed"

### 3-Year Picture
- **Definition:** A vivid description of what the company looks like in 3 years (revenue, profit, measurables, culture)

### 1-Year Plan
- **Definition:** Revenue, profit, measurables, and 3-7 goals for the current year

### Accountability Chart
- **Definition:** A function-based chart showing who owns what outcomes (not a traditional org chart)
- **Key distinction:** Defines accountability for outcomes, not reporting hierarchy

### GWC
- **Definition:** Get it, Want it, Capacity to do it — the test for "right seat"
- **All three must be "yes"** for someone to be in the right seat

### People Analyzer
- **Definition:** Tool for evaluating whether someone shares core values (+, +/-, -)

### Level 10 Meeting (L10)
- **Definition:** The weekly 90-minute leadership meeting following the specific EOS agenda
- **Synonyms:** "L10," "our weekly," "the Level 10"

### Segue
- **Definition:** The opening of any EOS meeting — sharing personal/professional good news
- **Rule:** No work problems discussed during Segue

### Meeting Pulse
- **Definition:** The rhythm of weekly and quarterly meetings that keeps the organization healthy

### Quarterly Meeting / Quarterly Planning
- **Definition:** Full-day off-site meeting every 90 days to review vision and set Rocks

### Rock Sheet
- **Definition:** A document listing company Rocks at top, individual Rocks below, reviewed weekly

### The Buildup
- **Definition:** The natural phenomenon where scheduling regular meetings causes people to prepare and think more deeply

---

## Status Values

### For Rocks (weekly review)
- **On Track** — Owner expects to complete by quarter end
- **Off Track** — Owner does not expect to complete; drops to Issues List

### For Scorecard Metrics (weekly review)
- **On Track** — Number meets or exceeds the goal
- **Off Track** — Number is below the goal; drops to Issues List

### For To-Dos (weekly review)
- **Done** — Completed within the 7-day window
- **Not Done** — Still pending (should not persist more than 2 weeks)

### For Rocks (quarterly review)
- **Done** — Completed by quarter end
- **Not Done** — Not completed; must choose: carry forward, convert remaining to to-do, or reassign

---

## Meeting Segment Indicators (for Transcript Parsing)

Use these patterns to identify which segment of an L10 meeting is occurring in a transcript:

| Segment | Duration | Key Phrases | Rule |
|---------|----------|-------------|------|
| Segue | 5 min | "good news," "this weekend," "personal best" | No work problems |
| Scorecard | 5 min | numbers, "on track," "off track," metric names | No discussion. Off track → Issues |
| Rock Review | 5 min | Rock names, "on track," "off track" | No discussion. Off track → Issues |
| Headlines | 5 min | client names, employee names, "happy," "upset" | Issues → Issues List |
| To-Do Review | 5 min | "done," "not done," action items from last week | Strike completed items |
| IDS | 60 min | "the real issue is," "let's solve," debate, problem-solving | Priority order. No tangents. |
| Conclude | 5 min | "to recap," "communicate to the team," "rate the meeting" | Rating goal: 8+ |

---

## Anti-Patterns (Things Ember Should Flag)

- **Too many Rocks:** More than 7 for company or individual → flag
- **Vague Rocks:** No measurable outcome → flag and suggest rewrite
- **Discussion during Scorecard/Rock review:** Someone launches into problem-solving → remind to drop to IDS
- **To-do persisting 2+ weeks:** → flag as potential issue or misclassified (should be a Rock?)
- **Consensus-seeking on issues:** "Let's all agree" → flag (EOS warns against "rule by consensus")
- **Scorecard metrics without goals:** Numbers without targets → flag
- **Meeting running over 90 minutes:** → flag
- **Skipping segments:** Any L10 segment skipped → flag
- **Rock completion below 80%:** → flag for root cause discussion
- **Issues List growing without resolution:** → flag pattern
