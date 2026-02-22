# Ember: AI-Powered Strategic Operating System for Caldera
## Product Requirements Document (PRD)
### Version 2.0 — February 22, 2026

**Version History:**
| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 1.0 | January 30, 2025 | Rich (Caldera) | Original PRD — Ember as AI Integrator for EOS |
| 2.0 | February 22, 2026 | Rich (Caldera) + Claude AI Strategic Partner | Major expansion — Agent System, advisory layer, multi-source ingestion, business model transformation support |

---

# PART 1: EMBER PLATFORM — EOS FOUNDATION

---

## 1. Executive Summary

Ember is an AI-powered strategic operating system for Caldera's three-partner leadership team. It began as an EOS (Entrepreneurial Operating System) Integrator — a "fourth partner" that facilitates EOS processes, holds the team accountable, and surfaces what's not being said. In v2.0, Ember evolves into a full strategic advisory platform with six specialized AI agents that provide proactive intelligence, automated data ingestion, and operational support across Finance, Marketing, Business Development, Operations, and Product Innovation — all orchestrated by a personal Executive Assistant for each partner.

**Core Philosophy (unchanged from v1.0):**
> "Don't just track what's said — surface what's NOT being said."

**v2.0 Addition:**
> "Don't just surface insights — act on them. Automate the preparatory work so leaders can focus on strategic decisions."

---

## 2. Product Vision

### What Ember Is
- A **fourth partner** that earns its seat at the table through intelligence, not just administration
- An expert in EOS methodology (Traction) that actively facilitates implementation
- A **board of AI advisors** across five critical business domains
- A **personal chief of staff** for each partner, tailored to their working style
- A pattern-recognition engine across all leadership conversations and business data
- A proactive presence that holds the team to their commitments
- An always-on system that ingests business data, analyzes it overnight, and delivers prioritized intelligence each morning

### What Ember Is Not
- A passive tracking tool
- A replacement for human judgment
- An external-facing product (internal to leadership only)
- A system that takes autonomous external action without approval
- A system that handles financial transactions, HR actions, or access control changes

---

## 3. Strategic Context (v2.0)

### 3.1 Company Profile

| Attribute | Detail |
|-----------|--------|
| Company | Caldera — Software Design & Development Services |
| Team Size | 14 (including 3 partners) |
| Revenue | ~$2.5M annually |
| Partners | Rich (CEO/CFO/COO/Integrator), John (Sales), Wade (Engineering/Solutions) |
| Operating System | Traction EOS (early implementation — V/TO in progress, L10s launching) |
| Primary Offering | Custom software product development, product strategy, AI consultation |

### 3.2 Revenue Distribution and Risk Profile

| Client Tier | Annual Revenue | % of Total | Risk Level |
|-------------|---------------|------------|------------|
| Anchor Client | $1,800,000 | ~73% | CRITICAL — single point of failure |
| Secondary Client | $480,000 | ~19% | MODERATE — healthy retainer |
| Remaining Clients | $200,000 | ~8% | LOW — insufficient diversification |

**Strategic imperative:** Revenue diversification is existential. Every component of Ember shares a foundational directive to support diversification while protecting the anchor client.

### 3.3 Business Model Transformation

Caldera is shifting from time-based billing to value-based fixed-fee engagements. AI tooling enables faster delivery — margin should improve with speed, not decline. This transformation affects pricing, positioning, scoping, delivery, sales, and financial modeling. Ember must actively support and accelerate this shift.

**From:** Team-based monthly billing (revenue scales with headcount and hours)
**To:** Value-based fixed-fee engagements (margin improves with delivery speed)

### 3.4 Market Dynamics

- Client expectations for delivery speed are accelerating due to AI tooling
- Caldera's consultation work is so effective it can eliminate ongoing client need — a pricing model problem
- Startups expect faster, cheaper product builds but current billing doesn't capture margin from speed
- Fortune 500 enterprises still offer longer-cycle traditional engagements
- Market is segmenting: enterprise (traditional) vs. mid-market/startup (value-based)

---

## 4. User Personas

### 4.1 Rich — The Strategist-Operator (Primary User)

**Roles:** CEO, CFO, COO, EOS Integrator, Product Manager
**Strengths:** Operations, relationships, product thinking, understanding systems, empathy
**Energizers:** Solving problems as a team, building impactful products, ethical business
**Drains:** Lack of progress, inaction
**Growth Areas:** Confidence in leadership, decision-making speed, delegation
**Working Style:** Strategic thinker, systems designer, comfortable with technical tools
**Pain Points:** Wearing too many hats, strategic work crowded out by operations

**System Interaction:** Power user. Morning briefings via Slack, deep work in Ember, Slack-based approval workflows, Claude Code for ad-hoc strategic analysis.
**Primary Value:** Reclaim time for strategic leadership and EOS implementation by offloading analytical, preparatory, and operational tasks to agents.

### 4.2 John — The Relationship Builder

**Role:** Sales Partner
**Strengths:** Relationship building, assessing what's not working, pushing the team
**Energizers:** Something to believe in, winning, entrepreneurial energy
**Drains:** Apathy, administrative tasks
**Growth Areas:** Emotional reactivity, patience, letting go of client relationships as personal property
**Working Style:** Relational, not systems-oriented, strong technical sales abilities but doesn't maintain tools well

**System Interaction:** Minimal direct interaction with Ember UI. Receives pushed intelligence via Slack — call prep, follow-up reminders, prospect research, proposal drafts. The system makes him more organized without requiring him to manage it.
**Primary Value:** System watches his communications and HubSpot activity, prepares him before sales calls, reminds him of follow-ups, drafts proposals and SOWs for review.

**Key Design Principle:** The system must be nearly invisible to John. It comes to him; he doesn't go to it. If it requires John to log in and manage data, adoption will fail.

### 4.3 Wade — The Technical Architect-Collaborator

**Role:** Engineering Partner, Solutions Architect
**Strengths:** Client communication, empathy, calm delivery, technical pragmatism
**Energizers:** Building great solutions, solving client problems
**Drains:** Unnecessary deliberation, over-explanation, emotional processing
**Growth Areas:** Personal connection with team, conflict avoidance, needs clear priorities
**Working Style:** Builder, empathetic problem solver, wants to contribute to platform evolution

**System Interaction:** Active collaborator in Ember. Interested in building and improving the platform. Wants visibility into sales pipeline, delivery evolution priorities, and team development needs.
**Primary Value:** Strategic context he'd otherwise miss, delivery process evolution guidance, visibility into what's coming from sales, and a platform he helps shape.

---

## 5. EOS Platform Capabilities (v1.0 — Built and Working)

These capabilities form the foundation that the agent system extends. They remain as originally specified, with enhancements noted.

### 5.1 V/TO Management
- Store and display the complete Vision/Traction Organizer with inline editing
- Version history tracking
- Surface when components need review or update
- Guide partners through V/TO creation and refinement via chat

### 5.2 Rock Tracking
- Quarterly Rocks with owners, status, milestones
- Proactive reminders based on due dates
- Status inference from meeting transcripts
- *v2.0 enhancement:* Agent-generated Rock proposals for quarterly planning

### 5.3 Scorecard Monitoring
- Weekly metrics tracking with targets and goal direction
- Owner accountability
- Trend visualization and alerts when metrics miss targets
- *v2.0 enhancement:* Auto-populated financial metrics from QuickBooks; auto-populated pipeline metrics from HubSpot

### 5.4 Issues Management
- Capture Issues from any source (manual, inferred from transcripts)
- Full IDS (Identify, Discuss, Solve) workflow
- Prioritization assistance
- Pattern detection (recurring issues, avoided topics)
- *v2.0 enhancement:* Agent-generated Issues with full context and recommended discussion points

### 5.5 To-Do Tracking
- 7-day to-dos from L10 meetings
- Owner assignment and due dates
- Completion tracking and rollover detection
- *v2.0 enhancement:* Agent-generated To-dos from meeting transcript extraction and identified actions

### 5.6 Meeting Support
- Meeting scheduling (L10, quarterly, annual)
- Meeting prep generation (cron job, 3 days before L10)
- *v2.0 enhancement:* Multi-agent prep leveraging all data sources; post-meeting auto-extraction of action items

### 5.7 AI Chat Interface
- Streaming conversation via Vercel AI SDK with 9 tool-calling capabilities
- Journey-aware system prompt adapts coaching style to EOS adoption stage
- Hybrid RAG: dual knowledge bases (396 EOS methodology chunks + meeting transcripts)
- RRF-fused semantic + keyword retrieval with dynamic context budget allocation

### 5.8 Transcript Processing Pipeline
- Upload → chunking with speaker detection → OpenAI embedding
- Claude extraction of issues, todos, decisions, potential scorecard metrics
- Deduped suggestions surfaced on Scorecard page
- *v2.0 enhancement:* Multi-agent extraction pipeline where each advisor processes transcripts for domain-specific insights

### 5.9 Organizational Checkup
- 20-question EOS health assessment
- Auto-save, team completion tracking, scoring
- Slack reminder bot for completion

### 5.10 Additional Platform Features
- Full dashboard UI (~25 pages) with responsive layout, dark/light mode
- Cmd+K global search
- Multi-tenant with RLS and allowed-email whitelist
- Slack OAuth with channel posting

### 5.11 Ember's Persona (unchanged)

**Name:** Ember (connects to Caldera's volcanic theme — warmth, persistence, potential to spark bigger flames)
**Tone:** Warm but not soft. Direct but not harsh.
**Relationship:** Partner, not servant.
**Behavior:** Will push back, detect avoidance, surface uncomfortable truths.
**Boundaries:** Knows its limits, defers to human judgment on decisions.

In the agent system, Ember remains the overarching identity. The advisory agents are capabilities and perspectives within Ember — not separate personalities the user interacts with independently. When Rich asks Ember a financial question, the Financial Strategist's analysis powers the response, but it's Ember speaking.

### 5.12 Decision-Making Behavior (unchanged)

When partners disagree, Ember responds based on context:

| Situation | Ember's Response |
|-----------|------------------|
| Minor disagreement | Offer a recommendation, keep moving |
| Substantive disagreement | Facilitate using IDS |
| Fundamental misalignment | Push for resolution before proceeding |
| Stalemate / emotional | Document as Issue, suggest break |

---

# PART 2: AGENT SYSTEM — STRATEGIC ADVISORY LAYER

---

## 6. Agent System Overview

The agent system is a collection of six specialized AI agents that extend Ember from an EOS facilitation tool into a full strategic operating system. The agents fill the critical gaps identified in Ember's original vision: multi-source data ingestion, proactive nudges and accountability, pattern detection, and strategic advisory across five business domains — all orchestrated by a personal Executive Assistant for each partner.

### 6.1 Agent Taxonomy

**Personal Agents (private scope per partner):**

| Agent | Primary User | Core Function |
|-------|-------------|---------------|
| Executive Assistant (EA) | Each partner (configured per role) | Daily orchestration, briefings, task management, approval workflows |

**Shared Advisory Agents (visible to all partners):**

| Agent | Domain | Core Function |
|-------|--------|---------------|
| Financial Strategist | Finance & Margins | Cash flow monitoring, margin analysis, financial modeling, L10 issue generation |
| Marketing Strategist | Brand & Positioning | Market positioning, public presence, competitive intelligence, content strategy |
| Business Development Strategist | Pipeline & Partnerships | Partnership identification, pipeline analysis, outreach strategy, lead intelligence |
| Operations Architect | Delivery & Process | SOW templates, delivery standardization, process improvement, quality assurance |
| Product Innovation Officer | New Revenue Streams | Product opportunity identification, bench time utilization, market gap analysis |

### 6.2 Shared Strategic Directive

All agents share a foundational context that informs their analysis:

1. **Revenue diversification is existential.** 73% concentration on one client is the primary risk.
2. **The business model is transforming.** Time-based → value-based fixed-fee. Evaluate opportunities through this lens.
3. **AI is changing the market.** Position as AI-enabled product consultants, not just developers.
4. **EOS is the operating rhythm.** All outputs map to EOS constructs where appropriate.
5. **Protect the anchor client.** While diversifying, the $1.8M relationship requires proactive health monitoring.

### 6.3 Agent Governance — The Trust Model

The governance model evolved from the original privacy/access model (ADR-003) with more granular zones:

**Zone 1 — Autonomous (no approval needed):**
Internal analysis and research, data synthesis, draft creation, EOS data creation (Issues, To-dos, Scorecard entries flagged as agent-generated), internal Slack notifications, recommendation generation, document organization.

**Zone 2 — Approval Required (agent prepares, human decides):**
External communications (emails, social posts, proposals), financial reporting to external parties, meeting scheduling with external parties, content publishing, EOS data modification (changing existing Rocks, modifying targets), escalation beyond partners.

**Zone 3 — Prohibited (never, even with approval):**
Financial transactions, access control changes, employment actions, legal commitments, credential management, permanent data deletion.

**Approval Workflow:**
1. Agent completes work → marks "ready for review"
2. EA surfaces in partner's briefing or Slack notification
3. Partner responds via Slack: approve, modify, defer, reject
4. EA routes decision and updates system state
5. Full audit trail in `agent_outputs` table

---

## 7. Agent Specifications

### 7.1 Executive Assistant (EA)

**Persona:** Chief of Staff — opinionated, organized, protective of the partner's time and focus

**Data Sources:** Google Calendar, Gmail, Slack, all advisory agent outputs, Ember EOS data, HubSpot

**Core Capabilities:**

| Capability | Description | Frequency |
|------------|-------------|-----------|
| Morning Briefing | Three-tier daily briefing pushed to Slack | Daily, 7:00 AM |
| Task Prioritization | Synthesize all sources into prioritized action list | Daily, refreshed as needed |
| Approval Queue | Present agent-recommended actions for review | Ongoing |
| Natural Language Command Processing | Interpret Slack replies to route decisions | Real-time |
| Calendar Intelligence | Surface prep needed for upcoming meetings | Daily + event-triggered |
| Follow-up Tracking | Monitor commitments and remind | Ongoing |
| EOS Ceremony Prep | Aggregate data for L10s, quarterly, annual planning | Per EOS rhythm |

**Morning Briefing Format:**

**Tier 1 — "Here's what needs your attention today":**
Urgent items, deadlines, time-sensitive decisions. Opinionated and prioritized with reasoning.

**Tier 2 — "Here's what's happening across your areas":**
Organized by category (Finance, Sales, Operations, Clients, EOS, Team). Each item flagged as: "you need to do this" / "agent can handle with your approval" / "FYI — already handled."

**Tier 3 — "Here's what's happening in your world":**
Curated industry news, market trends, competitor activity, relevant articles with summaries.

**Partner-Specific EA Configurations:**

*Rich's EA:* Cross-functional view across all agents. CFO-level financial alerts. EOS Integrator support. Strategic initiative tracking.

*John's EA:* Sales-call preparation pushed before every meeting. Follow-up reminders for open proposals. Pipeline summary and next-best-action. Draft SOWs and proposals queued for review. Push-heavy, pull-light — minimal interaction required.

*Wade's EA:* Engineering pipeline visibility (what's coming from sales). Team capacity and utilization alerts. Delivery practice evolution priorities. Technical trend briefings. Platform collaboration opportunities.

### 7.2 Financial Strategist

**Persona:** Fractional CFO — analytical, risk-aware, focused on sustainable growth and margin optimization

**Data Sources:** QuickBooks, Gusto, Ember Scorecard, HubSpot (deal values), utilization data

**Core Capabilities:**

| Capability | Description |
|------------|-------------|
| Margin-by-Client Analysis | Weekly effective margin per client/engagement |
| Cash Flow Monitoring | Rolling 13-week forecast with runway alerts |
| AR Aging Alerts | Flag overdue invoices with escalation recommendations |
| Revenue Concentration Dashboard | Track diversification progress |
| Financial Modeling | Fixed-fee vs. T&M scenarios for prospective deals |
| Utilization Tracking | Billable vs. bench time across team |
| Payroll-to-Revenue Ratio | Monthly labor cost health monitoring |

**Baseline Tasks:**
- Weekly: Margin-by-client view, cash flow forecast, AR aging check
- Monthly: P&L summary, utilization metrics, payroll ratio
- Quarterly: Diversification progress report, financial input for EOS planning
- Triggered: Alert when margin < 30%, AR > 45 days, cash runway < 8 weeks

### 7.3 Marketing Strategist

**Persona:** Fractional CMO — brand-obsessed, market-aware, focused on positioning Caldera as AI-enabled product consultants

**Data Sources:** Web research, HubSpot marketing metrics, Grain transcripts (client language patterns), social/LinkedIn data

**Core Capabilities:**

| Capability | Description |
|------------|-------------|
| Competitive Intelligence | Monitor competitor positioning and offerings |
| Market Positioning Framework | Define and refine Caldera's value proposition |
| Content Strategy | Identify topics for thought leadership |
| Client Language Mining | Extract how clients describe problems and Caldera's value |
| Public Presence Audit | Assess website/social against competitors |
| Industry Trend Curation | Surface relevant news for EA briefing Tier 3 |

**Standing Directive:** Develop and refine Caldera's positioning shift from "software development services" to "AI-powered product consultancy that delivers outcomes, not hours."

### 7.4 Business Development Strategist

**Persona:** VP of Partnerships — proactive, relationship-mapping, opportunity-seeking

**Data Sources:** HubSpot, Gmail, Grain transcripts, web research, LinkedIn

**Core Capabilities:**

| Capability | Description |
|------------|-------------|
| Pipeline Health Analysis | Deal stages, velocity, conversion rates |
| Partnership Target Identification | Research technology companies for strategic partnerships |
| Referral Pattern Analysis | Map business sources, identify amplification opportunities |
| Prospect Research | Pre-call intelligence briefs pushed to John |
| Proposal/SOW Support | Draft proposals from templates and call transcripts |
| Win/Loss Analysis | Patterns in what wins and what loses |
| Market Segmentation | Enterprise vs. mid-market/startup opportunity tracking |

**Standing Directive:** Shift Caldera from referral-dependent to proactively building pipeline through technology partnerships, white-label opportunities, and portfolio service arrangements.

### 7.5 Operations Architect

**Persona:** VP of Operations — process-minded, quality-focused, obsessed with repeatability

**Data Sources:** Ember EOS data, Grain transcripts, Google Drive (SOW templates, process docs), HubSpot (scope of sold deals)

**Core Capabilities:**

| Capability | Description |
|------------|-------------|
| SOW Template Management | Maintain and improve standard templates |
| SOW Drafting | Generate drafts from sales call transcripts |
| Delivery Process Documentation | Codify and standardize workflows |
| Scope Variance Monitoring | Track delivery against original scope |
| Client Satisfaction Signals | Mine communications for satisfaction indicators |
| Handoff Standardization | Clean transitions from sales → delivery → support |

**Standing Directive:** Develop the scoping methodology that makes fixed-fee engagements predictable and profitable, including historical analysis of estimate accuracy and scope creep patterns.

### 7.6 Product Innovation Officer

**Persona:** Internal Venture Strategist — creative, market-aware, focused on revenue diversification through buildable products

**Data Sources:** Web research, Grain transcripts, team capability profile, financial data (bench time), HubSpot (recurring client needs)

**Core Capabilities:**

| Capability | Description |
|------------|-------------|
| Product Opportunity Identification | Generate and evaluate product ideas from market signals |
| Bench Time Strategy | Deploy underutilized capacity toward product development |
| Build vs. Buy Analysis | Evaluate whether internal tools could become products |
| Market Validation Framework | Lightweight validation methodology |
| Technology Trend Mapping | Map emerging tech to Caldera capabilities |
| Revenue Model Analysis | Financial projections per product opportunity |

**Standing Directive:** Evaluate whether Ember itself (or components of it) could become a product offering for other small services companies implementing EOS.

---

## 8. Data Ingestion Architecture (v2.0)

*Extends ADR-002. See ADR-002 addendum for detailed implementation.*

### 8.1 Data Source Map

| Source | Data Type | Ingestion Method | Frequency | Primary Consumers |
|--------|-----------|-----------------|-----------|-------------------|
| Slack | Messages, threads, reactions | Events API (real-time) | Real-time | EA, all advisors |
| Gmail | Emails, threads, attachments | Google API (polling) | Every 15 min | EA, BD Strategist, Ops Architect |
| Google Calendar | Events, attendees | Google API (polling) | Every 15 min | EA |
| Google Drive | Documents, SOWs, proposals | Google API (on-demand) | Triggered | Ops Architect, Marketing |
| HubSpot | Deals, contacts, companies | API + webhooks | Every 30 min + real-time | BD Strategist, Financial Strategist |
| QuickBooks | Invoices, AR/AP, P&L | QuickBooks API (batch) | Daily overnight | Financial Strategist |
| Gusto | Payroll, employee data | Gusto API (batch) | Weekly | Financial Strategist, EA |
| Grain | Meeting transcripts | Grain API / MCP | Post-meeting | All advisors |
| Web | Industry news, competitors | Search APIs | Scheduled + on-demand | Marketing, BD, Product Innovation |

### 8.2 Processing Pipeline

All data flows through: Ingest → Normalize → Embed → Store → Index → Notify relevant agents. See Integration Documentation for service-by-service implementation details.

---

## 9. Interaction Architecture (v2.0)

*Extends ADR-001 (multi-channel interaction). See ADR-007 for detailed Slack-first design.*

### 9.1 Slack — The Ambient Layer (Primary)

The original PRD identified Slack as a key channel. In v2.0, Slack becomes the primary interaction surface for all routine agent interactions.

**Channels:**
- Partner DMs — personal EA briefings, approval queue, commands
- `#ember-insights` — shared agent insights visible to all partners
- `#eos-pulse` — Rock reminders, Scorecard nudges, To-do tracking
- `#ember-system` — system health alerts (Rich only)

**Interaction:** Partners reply to briefings in natural language. EA parses commands, routes decisions, and confirms actions. Emoji reactions for quick approvals (✅ approve, ⏸️ defer, ❌ reject).

### 9.2 Ember UI — The Deep Work Interface

The existing dashboard and chat remain the deep work interface for EOS data management, document review, agent activity monitoring, approval queue (interactive), advisory dashboards, and agent configuration.

### 9.3 Claude Code — Rich's Personal Strategic Workbench

Not part of the Ember platform, but a key part of Rich's workflow for ad-hoc deep analysis, unstructured strategic thinking, and building Ember itself. Patterns from Claude Code sessions that prove valuable become candidates for formalization as agent capabilities.

---

## 10. EOS Integration (v2.0)

*See ADR-009 for detailed design.*

All agent outputs map to EOS constructs. Agents do not create parallel management systems.

| Agent Output | EOS Construct |
|-------------|---------------|
| Strategic insights | Issues (with IDS-ready context) |
| Metric recommendations | Scorecard entries |
| Priority recommendations | Rock proposals (for quarterly planning) |
| Action items | To-dos (7-day cycle) |
| Pattern observations | Issues or meeting agenda items |
| Accountability nudges | Tied to existing Rocks and To-dos |

### Proactivity Escalation Pattern (evolved from v1.0)

The original PRD defined a 4-step escalation. The agent system implements this with data-driven triggers:

1. **Gentle reminder** (automated): "Your Rock milestone '[X]' is due in 3 days."
2. **Direct nudge** (automated): "This is the second week without update. What's blocking progress?"
3. **Pattern observation** (automated): "Third week — is this still the right priority?"
4. **L10 escalation** (Zone 2 — surfaces for group discussion): Creates Issue with full context and data

**The "Surface What's Not Being Said" Principle:**
When the system detects patterns — a Rock "on track" for 6 weeks with no milestone progress, partners avoiding a topic, metrics trending wrong while no Issues raised — the EA surfaces these as diplomatically-framed Issues with data, not accusations.

---

## 11. Week 1 Build Plan

### Guiding Principle
Ship the smallest useful version of the EA and one advisory agent within 5 business days. Prove the daily briefing → Slack interaction → approval workflow loop works.

| Day | Focus | Key Deliverable |
|-----|-------|----------------|
| 1 | EA Data Ingestion | Gmail + Calendar connectors, bidirectional Slack |
| 2 | Morning Briefing V1 | Three-tier briefing generation + Slack delivery at 7:00 AM |
| 3 | Slack Command Processing | Natural language reply parsing + state updates |
| 4 | Financial Strategist V1 | QuickBooks connector + margin analysis + alerts |
| 5 | Integration Test + Demo | End-to-end loop working, partner feedback collected |

### Week 1 Success Criteria
- [ ] Rich receives a useful morning briefing in Slack by 7:00 AM
- [ ] Rich can reply in natural language and the system responds appropriately
- [ ] At least one Financial Strategist insight appears in the briefing
- [ ] EOS data (Rock deadlines, overdue To-dos) appears in the briefing
- [ ] The system creates at least one L10 Issue draft from Financial Strategist analysis
- [ ] John and Wade have seen the system and provided feedback

---

## 12. Phased Roadmap

### Phase 1: Weeks 2-4 — Core Agent Activation
- Complete Financial Strategist with full QuickBooks integration
- Activate Operations Architect with SOW template library and draft generation
- Activate BD Strategist with HubSpot integration and pre-call briefs for John
- Implement John's and Wade's EA variants
- Add automated industry news curation to briefings

### Phase 2: Weeks 5-8 — Intelligence Layer
- Activate Marketing Strategist with competitive intelligence
- Activate Product Innovation Officer with opportunity identification
- Build pattern detection engine (avoidance, misalignment, stalled priorities)
- Implement proactive nudge escalation system
- Grain auto-ingestion and multi-agent transcript processing
- Slack ingestion (read leadership channel for context)

### Phase 3: Weeks 9-12 — Maturity and Optimization
- Agent collaboration framework (agents request input from each other)
- Advanced financial modeling (fixed-fee scenarios, revenue forecasting)
- Client health scoring across all data sources
- Full EOS ceremony automation
- Agent performance metrics and self-improvement
- Evaluate Ember as potential product offering

---

## 13. Technical Requirements

### 13.1 Performance
- Morning briefing: complete within 5 minutes of trigger
- Slack command response: acknowledge within 10 seconds
- Data ingestion: no more than 30 minutes stale for real-time sources
- Agent analysis: complete within 2 minutes for standard operations

### 13.2 Reliability
- Morning briefing: 99% delivery uptime
- Graceful degradation: generate briefing with available data, note what's missing
- Error notifications: alert Rich if any pipeline fails

### 13.3 Security
- API credentials in environment variables only
- Supabase RLS enforced on all agent data access
- OAuth tokens refreshed per best practices
- No sensitive financial data in Slack messages — deep links to Ember

---

## 14. Success Metrics

### Week 1
- Morning briefing usefulness rating (Rich's subjective 1-10)
- Number of Slack commands successfully processed
- Partner feedback sentiment from demo

### Month 1
- Hours per week saved by Rich on operational tasks (target: 5+)
- Number of L10 Issues auto-generated by agents
- John engagement: pre-call briefs consumed
- Financial Strategist accuracy: predicted vs. actual margin variance

### Quarter 1
- Revenue diversification progress (new client revenue as % of total)
- EOS adoption score improvement (Organizational Checkup)
- SOWs drafted by Operations Architect vs. manually created
- Agent recommendation acceptance rate
- Partner satisfaction survey

---

## 15. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Partner adoption (especially John) | HIGH | HIGH | Design John's experience as push-only; demo value in Week 1 |
| AI gives bad advice | MEDIUM | HIGH | Ground in EOS methodology + Caldera context; human always decides |
| Agent "noise" — too many low-value alerts | MEDIUM | HIGH | Conservative thresholds; weekly tuning |
| Data quality from API integrations | MEDIUM | MEDIUM | Validate on ingestion; graceful degradation |
| Privacy breach | LOW | CRITICAL | Strict access controls; leadership-only boundary; no external actions |
| Over-reliance on AI | LOW | HIGH | Agents frame as recommendations; human approval required |
| EOS implementation stalls | MEDIUM | HIGH | Agents reinforce EOS rhythm; system value partially independent |
| Scope creep on agent capabilities | HIGH | MEDIUM | Strict Week 1 scope; phased roadmap |

---

## 16. Open Questions

### From v1.0 (still open)
1. Should Ember eventually be productized for other EOS teams?
2. What's the long-term hosting/cost model?
3. How do we handle Ember's personality when delivering tough feedback?
4. What's the escalation path if partners don't respond to nudges? *(Partially addressed in ADR-009)*

### New in v2.0
5. Does Caldera use a time tracking tool? Utilization data is critical for Financial Strategist.
6. Does Caldera have Google Analytics on their website? Needed for Marketing Strategist.
7. What tool tracks project delivery status beyond EOS data in Ember?
8. How many existing SOW templates/examples are in Google Drive?
9. Can Grain API access all team meeting transcripts, or only authenticated user's?
10. Does John primarily use Gmail for prospect communication, or also LinkedIn/phone/text?
11. What's the budget tolerance for API usage (Claude, search, etc.)?

---

## 17. Architecture Decision Records

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| ADR-001 | AI Persona & Interaction Model | Accepted (+ v2.0 addendum) | Jan 30, 2025 |
| ADR-002 | Data Ingestion Architecture | Accepted (+ v2.0 addendum) | Jan 30, 2025 |
| ADR-003 | Privacy & Access Model | Accepted (+ v2.0 addendum) | Jan 30, 2025 |
| ADR-004 | Real-time vs. Async Processing | Accepted (+ v2.0 addendum) | Jan 30, 2025 |
| ADR-005 | Technology Stack | Accepted (+ v2.0 addendum) | Jan 30, 2025 |
| ADR-006 | Agent Architecture Pattern | Accepted | Feb 22, 2026 |
| ADR-007 | Slack-First Interaction Model | Accepted | Feb 22, 2026 |
| ADR-008 | Extend Ember Platform | Accepted | Feb 22, 2026 |
| ADR-009 | EOS Process Integration | Accepted | Feb 22, 2026 |
| ADR-010 | Business Model Transformation Support | Accepted | Feb 22, 2026 |

---

## Appendix A: Technical Documentation

- **System Design Document** — Full technical architecture (agent runtime, orchestrator, database schema, API routes, model selection, security)
- **Integration Documentation** — Service-by-service integration specs (Gmail, Calendar, Drive, Slack, HubSpot, QuickBooks, Gusto, Grain)
