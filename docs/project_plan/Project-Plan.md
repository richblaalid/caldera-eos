# Ember: Project Plan
## Development Roadmap for AI Integrator MVP

---

## Overview

**Goal:** Ship an MVP that supports Caldera's EOS implementation with AI-powered tracking, coaching, and accountability.

**Timeline:** 2-week sprint to first usable version

**Build Tool:** Claude Code

**Team:** Caldera engineering team

---

## Success Criteria for MVP

By end of Week 2, Ember should:
1. ✅ Store and display the V/TO
2. ✅ Track Rocks with owner, status, and updates
3. ✅ Track Scorecard metrics with weekly entries
4. ✅ Manage Issues list with IDS status
5. ✅ Track To-dos with completion
6. ✅ Ingest meeting transcripts and extract insights
7. ✅ Generate L10 meeting prep 2 days before
8. ✅ Provide chat interface for EOS coaching and questions
9. ✅ Authenticate users via Google OAuth

---

## Phase 0: VTO Session Support (Pre-Sprint)

**Goal:** Support Rich's facilitation of Tuesday's VTO session

**Deliverables:** (Created in this conversation)
- ✅ VTO Session Facilitation Guide
- ✅ GWC Synthesis Template
- ✅ Core Values Workshop Materials
- ✅ EOS Coaching Notes
- ✅ Discussion Prompts for Hard Conversations
- ✅ V/TO Template

**Timeline:** Complete before Tuesday, February 4, 2025

**Action Items:**
- [ ] Rich: Collect GWC assessments from John and Wade
- [ ] Rich: Share assessments with Ember for synthesis
- [ ] Claude: Update GWC Synthesis with analysis
- [ ] Rich: Review all prep materials before session

---

## Phase 1: Foundation (Days 1-2)

**Goal:** Core infrastructure and basic UI

### Day 1: Setup & Auth

| Task | Description | Hours |
|------|-------------|-------|
| Project init | Create Next.js project with TypeScript | 1 |
| Supabase setup | Create project, configure auth | 1 |
| Auth implementation | Google OAuth flow, protected routes | 3 |
| User profile | Basic profile storage and display | 1 |
| Tailwind setup | Configure styling, create design tokens | 1 |
| Deploy | Initial Vercel deployment | 1 |

**Deliverable:** Users can log in with Google, see authenticated state

### Day 2: Database & Basic Layout

| Task | Description | Hours |
|------|-------------|-------|
| Schema creation | Run migrations for core tables | 2 |
| Supabase client | Configure client for frontend and API | 1 |
| Dashboard layout | Navigation, sidebar, main content area | 3 |
| Component library | Button, Card, Input, Modal primitives | 2 |

**Deliverable:** Authenticated dashboard shell with navigation

---

## Phase 2: V/TO + Rocks (Days 3-4)

**Goal:** Track the core EOS components

### Day 3: V/TO Management

| Task | Description | Hours |
|------|-------------|-------|
| V/TO data model | Finalize JSONB structure | 1 |
| V/TO API routes | CRUD endpoints | 2 |
| V/TO display page | Read-only view of all sections | 3 |
| V/TO edit mode | Inline editing with auto-save | 2 |

**Deliverable:** V/TO visible and editable in dashboard

### Day 4: Rocks Tracking

| Task | Description | Hours |
|------|-------------|-------|
| Rocks API routes | CRUD, status updates | 2 |
| Rocks list view | Current quarter Rocks with status | 2 |
| Rock detail view | Milestones, notes, history | 2 |
| Status workflow | On-track, Off-track, Complete states | 1 |
| Owner assignment | Link Rocks to partners | 1 |

**Deliverable:** Quarterly Rocks tracked with status and owners

---

## Phase 3: Scorecard + Issues (Days 5-6)

**Goal:** Weekly metrics and issue management

### Day 5: Scorecard

| Task | Description | Hours |
|------|-------------|-------|
| Metrics API | CRUD for metrics and entries | 2 |
| Scorecard view | Weekly grid with targets | 3 |
| Data entry | Quick entry for weekly values | 2 |
| Target indicators | Visual status (green/yellow/red) | 1 |

**Deliverable:** Scorecard tracking with weekly data entry

### Day 6: Issues Management

| Task | Description | Hours |
|------|-------------|-------|
| Issues API | CRUD, prioritization | 2 |
| Issues list | Sortable, filterable list | 2 |
| IDS workflow | Identify → Discuss → Solve states | 2 |
| Issue detail | Full view with discussion notes | 2 |

**Deliverable:** Issues tracked with IDS workflow

---

## Phase 4: To-dos + L10 Prep (Days 7-8)

**Goal:** Task tracking and meeting preparation

### Day 7: To-dos

| Task | Description | Hours |
|------|-------------|-------|
| To-dos API | CRUD, completion | 2 |
| To-dos list | By owner, by due date | 2 |
| Quick add | Fast to-do creation | 1 |
| Completion tracking | Check off, rollover detection | 2 |
| Link to meetings | Associate to-dos with L10 outcomes | 1 |

**Deliverable:** To-do tracking with completion

### Day 8: L10 Meeting Prep

| Task | Description | Hours |
|------|-------------|-------|
| Meeting model | Store meeting metadata | 1 |
| Prep generation | AI generates prep based on current data | 4 |
| Prep display | Meeting prep page | 2 |
| Scheduled job | Generate prep 2 days before | 1 |

**Deliverable:** Auto-generated L10 prep available before meetings

---

## Phase 5: Transcript Ingestion (Days 9-10)

**Goal:** Process meeting transcripts for context and insights

### Day 9: Transcript Upload

| Task | Description | Hours |
|------|-------------|-------|
| File upload | Accept .txt, .md, .doc transcripts | 2 |
| Text extraction | Parse and clean transcript text | 2 |
| Storage | Save full transcript and metadata | 1 |
| Transcript list | View all uploaded transcripts | 2 |
| Transcript detail | View full text with search | 1 |

**Deliverable:** Transcripts uploadable and viewable

### Day 10: Transcript Analysis

| Task | Description | Hours |
|------|-------------|-------|
| Chunking | Split transcripts into searchable chunks | 2 |
| Embeddings | Generate and store vector embeddings | 2 |
| Extraction | AI extracts decisions, issues, to-dos | 3 |
| Link to EOS | Create Issues/To-dos from extraction | 1 |

**Deliverable:** Transcripts processed, insights extracted

---

## Phase 6: EOS Coaching Layer (Days 11-12)

**Goal:** AI chat interface for coaching and questions

### Day 11: Chat Infrastructure

| Task | Description | Hours |
|------|-------------|-------|
| Chat API | Message handling, context retrieval | 3 |
| Chat UI | Message list, input, streaming | 3 |
| Context retrieval | Pull relevant transcripts and EOS data | 2 |

**Deliverable:** Basic chat working

### Day 12: Coaching Intelligence

| Task | Description | Hours |
|------|-------------|-------|
| System prompt | Ember persona, EOS expertise, Caldera context | 3 |
| RAG pipeline | Retrieve relevant context for questions | 2 |
| Coaching prompts | Specific prompts for common scenarios | 2 |
| Private chat storage | User-specific chat history | 1 |

**Deliverable:** AI chat with EOS coaching and context awareness

---

## Phase 7: Polish + Launch (Days 13-14)

**Goal:** Production-ready for first real L10

### Day 13: Integration & Testing

| Task | Description | Hours |
|------|-------------|-------|
| End-to-end testing | Full workflow verification | 3 |
| Bug fixes | Address issues from testing | 3 |
| Performance | Optimize slow queries, add caching | 2 |

### Day 14: Launch Prep

| Task | Description | Hours |
|------|-------------|-------|
| Final deployment | Production environment | 1 |
| Seed data | Import V/TO and historical context | 2 |
| Documentation | Brief user guide | 2 |
| Walkthrough | Demo with Rich | 2 |
| Go live | Enable for first L10 | 1 |

**Deliverable:** Ember live and ready for first L10

---

## Post-MVP Backlog (Future Phases)

### Phase 8: Slack Integration
- [ ] Leadership channel posting
- [ ] Individual DM reminders
- [ ] Slash commands for quick updates
- [ ] Real-time notifications

### Phase 9: Proactive Accountability
- [ ] Reminder scheduling
- [ ] Escalation patterns
- [ ] Pattern detection
- [ ] Nudge system

### Phase 10: HubSpot Integration
- [ ] Pipeline data sync
- [ ] Scorecard auto-population
- [ ] Deal tracking
- [ ] Activity logging

### Phase 11: Advanced Insights
- [ ] Sentiment analysis
- [ ] Pattern detection across meetings
- [ ] Metric suggestions
- [ ] Avoidance detection

### Phase 12: Live Meeting Support
- [ ] Real-time transcript streaming
- [ ] In-meeting queries
- [ ] Active facilitation
- [ ] Time tracking

---

## Technical Milestones

| Milestone | Target Date | Criteria |
|-----------|-------------|----------|
| Auth working | Day 1 | Users can log in with Google |
| Dashboard live | Day 2 | Basic layout deployed |
| V/TO functional | Day 3 | Can view and edit V/TO |
| Rocks tracking | Day 4 | Full CRUD for Rocks |
| Scorecard working | Day 5 | Weekly data entry functional |
| Issues tracked | Day 6 | IDS workflow complete |
| To-dos functional | Day 7 | Completion tracking works |
| Prep generation | Day 8 | AI generates L10 prep |
| Transcripts ingested | Day 10 | Upload and search working |
| Chat functional | Day 12 | AI coaching conversation works |
| MVP complete | Day 14 | All features integrated |

---

## Risk Mitigation

| Risk | Mitigation | Owner |
|------|------------|-------|
| Scope creep | Strict MVP definition; backlog everything else | Rich |
| API rate limits | Caching, batching, queue for non-urgent | Eng |
| Auth issues | Use Supabase templates; test early | Eng |
| AI quality | Extensive prompt testing; human review | Eng |
| Timeline slip | Cut to core features; polish in next sprint | Rich |

---

## Definition of Done

A feature is "done" when:
1. ✅ Functionality works as specified
2. ✅ UI is usable (doesn't need to be perfect)
3. ✅ Data persists correctly
4. ✅ Auth gates work properly
5. ✅ Deployed to production
6. ✅ Brief manual test passes

---

## Communication

**Daily standups:** Quick async update in Slack
**Blockers:** Escalate immediately
**Decisions:** Document in ADRs if significant
**Demo:** End of each phase

---

## Resources

- PRD: `/caldera-ember-prd/PRD-Ember-AI-Integrator.md`
- ADRs: `/caldera-ember-prd/ADR-*.md`
- VTO Session Prep: `/caldera-vto-session-prep/`
- Traction Book: `/mnt/project/Traction_-_Gino_Wickman.epub`
- Caldera EOS Extract: `/mnt/project/caldera_eos_extract.md`
