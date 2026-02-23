# Ember: AI Integrator for Caldera
## Product Requirements Document (PRD)
### Version 1.0 — January 30, 2025

---

## Executive Summary

Ember is an AI-powered EOS Integrator designed to serve as Caldera's fourth partner. Unlike traditional EOS tracking tools, Ember actively participates in the leadership rhythm: facilitating sessions, holding partners accountable, surfacing unspoken issues, and generating strategic insights. The goal is an AI that earns its seat at the table through generative intelligence—not just administrative tracking.

**Primary Goal:** Build an AI that acts as an expert Integrator for Caldera's EOS implementation.

**Success Criteria:** The AI is considered successful when it surfaces what's NOT being said—noticing patterns humans miss, suggesting new metrics, pulling buried ideas forward, and connecting dots across conversations.

---

## Product Vision

### What Ember Is
- A **fourth partner**, not an assistant
- An expert in EOS methodology (Traction)
- A facilitator, coach, and accountability partner
- A pattern-recognition engine across all leadership conversations
- A proactive presence that holds the team to their commitments

### What Ember Is Not
- A passive tracking tool
- A replacement for human judgment
- An external-facing product (internal to leadership only)
- A system that takes action without approval

### Core Philosophy
> "Don't just track what's said—surface what's NOT being said."

---

## User Context

### Primary Users
Three founding partners of Caldera:
- **Rich** — Integrator, Head of Finance/Operations, facilitating EOS implementation
- **John** — Head of Sales, relationship builder, needs a product he believes in
- **Wade** — Head of Operations/Delivery, technical leader, needs clear priorities

### User Needs (From Interview)
1. Accountability without constant overhead
2. Insight into patterns they can't see themselves
3. Preparation and coaching for EOS sessions
4. Real-time participation in meetings (future)
5. A single source of truth for EOS components

### Trust Level Required
High. Ember will have access to sensitive leadership conversations, financials, and interpersonal dynamics. It must handle this with discretion and never expose information externally.

---

## Persona & Interaction Model

### Persona: Ember
- **Tone:** Friendly yet professional
- **Behavior:** Direct, not acquiescing
- **Role:** Fourth partner, not servant
- **Philosophy:** Will hold the team accountable, push back when needed, detect avoidance

### Name Rationale
"Ember" connects to Caldera's volcanic theme while suggesting warmth, persistence, and the potential to spark bigger flames. Alternative considered: "Forge" (purposeful, strong through pressure).

### Interaction Channels

| Channel | Purpose | Frequency |
|---------|---------|-----------|
| **Dashboard** | Central hub for V/TO, Rocks, Scorecard, Issues, To-dos | Always on |
| **Chat Interface** | Individual conversations for progress, questions, prep | On demand |
| **Slack DMs** | Personal accountability nudges | Proactive |
| **Slack Leadership Channel** | Group visibility, announcements, insights | Proactive |
| **Meeting Presence** | Listen live, answer questions, eventually participate | During L10s |

### Proactivity Escalation Pattern
1. **Gentle nudge:** "Your Rock on X hasn't been updated this week."
2. **Direct prompt:** "This is the second week—what's blocking progress?"
3. **Pattern observation:** "This is the third week without an update. Is this Rock still the right priority?"
4. **Escalation:** Surface in L10 prep for group discussion

---

## Core Capabilities

### 1. V/TO Management
- Store and display the complete Vision/Traction Organizer
- Track changes and version history
- Surface when components need review or update
- Guide partners through VTO creation and refinement

### 2. Rock Tracking
- Track quarterly Rocks with owners, status, milestones
- Proactive reminders based on due dates
- Status inference from meeting transcripts
- Escalation when Rocks are off-track

### 3. Scorecard Monitoring
- Weekly metrics tracking with targets
- Owner accountability
- Trend visualization
- Alert when metrics miss targets
- Suggest new metrics based on conversation patterns

### 4. Issues Management
- Capture Issues from any source (manual, inferred from transcripts)
- IDS tracking (Identify, Discuss, Solve)
- Prioritization assistance
- Pattern detection (recurring issues, avoided topics)

### 5. To-Do Tracking
- 7-day to-dos from L10 meetings
- Owner assignment and due dates
- Completion tracking
- Rollover detection

### 6. Meeting Preparation
- Two business days before L10:
  - Summary of completed items
  - List of outstanding items
  - New issues surfaced since last meeting
  - Follow-ups needing closure
  - Personalized prep for each partner
- Agenda generation based on EOS L10 format

### 7. Meeting Processing
- **MVP:** Process transcripts after meetings
- **Target:** Listen live, answer questions during meeting
- **Future:** Active participation (time tracking, agenda management, IDS facilitation)

### 8. Sentiment & Pattern Analysis
- Detect team morale/energy shifts
- Surface client concerns from conversations
- Identify interpersonal friction
- Spot recurring complaints or frustrations
- Find patterns of avoidance (topics consistently not addressed)
- Compare what's SAID vs. what's DONE

### 9. EOS Coaching
- Explain EOS concepts on demand
- Provide facilitation guidance
- Suggest prompts for difficult discussions
- Offer recommendations grounded in Caldera's context

---

## Autonomy & Authority

### What Ember Can Do Without Approval
- Nudge partners via DM
- Surface insights in the dashboard
- Prepare materials and agendas
- Post to leadership Slack channel
- Track and report on metrics

### What Requires Explicit Approval
- Take actions visible to the broader Caldera team
- Modify any shared documents
- Send communications to anyone outside leadership

### What Ember Can Never Do
- Communicate with customers
- Send external communications on behalf of partners
- Take autonomous action that affects the business
- Share leadership discussions outside the three partners

---

## Decision-Making Behavior

When partners disagree, Ember should respond based on context:

| Situation | Ember's Response |
|-----------|------------------|
| Minor disagreement | Offer a recommendation, keep moving |
| Substantive disagreement | Facilitate using IDS |
| Fundamental misalignment | Push for resolution before proceeding |
| Stalemate / emotional | Document as Issue, suggest break |

---

## Data Sources

### MVP Integrations
| Source | Data | Integration Method |
|--------|------|-------------------|
| Transcript Folder | Meeting notes | File drop or Grain API |
| Slack | Leadership channel conversations | Slack API |
| HubSpot | Pipeline data for Scorecard | HubSpot API |
| Financial Spreadsheet | Cash flow, utilization | CSV import initially |
| Historical Transcript Doc | Past meeting context | One-time import |

### Future Integrations
- Grain (direct recording integration)
- Accounting tools (QuickBooks, etc.)
- Calendar (for meeting scheduling)

---

## Privacy & Access Model

### Default: Full Transparency
- All three partners see the same dashboard
- All Rocks, Issues, Scorecard data visible to all

### Private Space: Chat
- Each partner can chat privately with Ember
- For working through ideas before bringing to group
- Ember may prompt: "This seems like something to bring to the group. Want me to add it to Issues?"

### Boundary: Leadership Only
- Nothing goes beyond Rich, John, Wade without explicit approval
- No automatic forwarding to team channels
- No customer visibility ever

---

## User Experience

### Dashboard (Central Hub)
- V/TO summary
- Rocks status (current quarter)
- Scorecard (weekly metrics)
- Issues List (prioritized)
- To-dos (7-day)
- Upcoming meeting prep
- Insights feed (AI observations)

### Chat Interface
- Conversational interaction
- Ask questions about Caldera context
- Request prep materials
- Get coaching on EOS concepts
- Work through sensitive topics privately

### Slack Integration
- **Leadership Channel:**
  - Weekly Scorecard summary
  - Rock status updates
  - Meeting prep reminders
  - Insights worth group attention
- **Individual DMs:**
  - Personal to-do reminders
  - Accountability nudges
  - Prep prompts

---

## Technical Architecture

### Recommended Stack
- **Frontend:** Next.js (React + API routes)
- **Backend:** Next.js API routes + optional FastAPI for heavy processing
- **Database:** Supabase (PostgreSQL + Auth + Real-time)
- **Vector DB:** Supabase pgvector (for transcript search/memory)
- **AI:** Claude API (Anthropic)
- **Auth:** Google OAuth via Supabase
- **Hosting:** Vercel (frontend) + Railway/Fly.io (background jobs)
- **Integrations:** Slack API, HubSpot API

### Key Technical Decisions
- See ADR documents for detailed rationale
- ADR-001: AI Persona & Interaction Model
- ADR-002: Data Ingestion Architecture
- ADR-003: Privacy & Access Model
- ADR-004: Real-time vs. Async Processing
- ADR-005: Technology Stack

---

## Development Phases

### Phase 0: VTO Facilitation Prep (This Week)
**Goal:** Support Tuesday's VTO session
- AI prepares session materials
- Draft values based on transcript analysis
- Agenda with time blocks
- Discussion prompts
- GWC synthesis (once assessments received)

### Phase 1: Foundation (Days 1-2)
- Data models for EOS components
- Auth with Google OAuth
- Basic dashboard UI
- Database schema

### Phase 2: V/TO + Rocks (Days 3-4)
- V/TO display and editing
- Rock tracking with status
- Basic reporting

### Phase 3: Scorecard + Issues (Days 5-6)
- Scorecard with weekly entry
- Issues list with IDS tracking
- Dashboard integration

### Phase 4: To-dos + L10 Prep (Days 7-8)
- To-do tracking
- Meeting prep generation
- Reminder system

### Phase 5: Transcript Ingestion (Days 9-10)
- File upload for transcripts
- Text extraction and chunking
- Vector storage for search
- L10 follow-up detection

### Phase 6: EOS Coaching Layer (Days 11-12)
- Chat interface
- EOS methodology knowledge
- Caldera context awareness
- Coaching prompts

### Phase 7: Polish + First Real L10 (Days 13-14)
- End-to-end testing
- UI refinement
- Deploy for first real L10

### Future Phases
- Live meeting integration
- Slack integration
- HubSpot integration
- Sentiment analysis
- Active meeting participation

---

## Success Metrics

### Quantitative
- All Rocks tracked and updated weekly
- Scorecard populated before every L10
- L10 prep delivered 2 business days before meeting
- To-do completion rate visible

### Qualitative (What Makes It Feel "Real")
- Surfaces patterns humans missed
- Suggests new metrics based on observations
- Pulls buried ideas forward for discussion
- Connects dots across conversations
- Holds partners accountable without being asked
- Partners describe it as "like having another person in the room"

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| AI gives bad advice | Ground in EOS methodology + Caldera context; human always decides |
| Privacy breach | Strict access controls; leadership-only boundary |
| Adoption resistance | Start with high-value low-friction (prep materials); build trust |
| Over-reliance | AI prompts for human decision; never takes autonomous action |
| Technical complexity | Phased approach; ship MVP, iterate |

---

## Open Questions

1. Should Ember eventually be productized for other EOS teams?
2. What's the long-term hosting/cost model?
3. How do we handle Ember's personality when delivering tough feedback?
4. What's the escalation path if partners don't respond to Ember's nudges?

---

## Appendix: Partner Profiles (For AI Context)

### John
- **Role:** Head of Sales
- **Strengths:** Relationship building, assessing what's not working, pushing the team
- **Energizers:** Something to believe in, winning, entrepreneurial energy
- **Drains:** Apathy, administrative tasks
- **Growth areas:** Emotional reactivity, patience, letting go of client relationships as personal property
- **Needs from AI:** A product he believes in, clear pipeline metrics, support for the things he doesn't want to do

### Wade
- **Role:** Head of Operations/Delivery
- **Strengths:** Client communication, empathy, calm delivery, technical pragmatism
- **Energizers:** Building great solutions, solving client problems
- **Drains:** Unnecessary deliberation, over-explanation, emotional processing
- **Growth areas:** Personal connection with team, conflict avoidance, needs clear priorities
- **Needs from AI:** Clear priorities, status communication support, technical guidance

### Rich
- **Role:** Integrator, Head of Finance
- **Strengths:** Operations, relationships, product thinking, understanding systems, empathy
- **Energizers:** Solving problems as a team, building impactful products, ethical business
- **Drains:** Lack of progress, inaction
- **Growth areas:** Confidence in leadership, decision-making speed, delegation
- **Needs from AI:** Accountability support, pattern surfacing, facilitation assistance
