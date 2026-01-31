# Ember: Task List

## Overview
Executable task list for building Ember MVP. Each task includes acceptance criteria and dependencies.

---

## Phase 1: Foundation (Days 1-2)

**Goal:** Core infrastructure and basic UI

### Day 1: Setup & Auth

- [x] **1.1.1** Create Next.js project with TypeScript
  - Create Next.js 14 App Router project with TypeScript, Tailwind, ESLint
  - Configure project structure per ADR-005
  - **Acceptance:** `npm run dev` starts successfully

- [x] **1.1.2** Configure Supabase project and auth
  - Create Supabase project (or use existing)
  - Enable Google OAuth provider
  - Configure redirect URLs
  - **Acceptance:** Supabase dashboard shows project configured

- [x] **1.1.3** Implement Google OAuth flow and protected routes
  - Install @supabase/ssr package
  - Create Supabase server/client utilities
  - Build login page with Google OAuth button
  - Add middleware for route protection
  - **Acceptance:** Users can log in with Google, protected routes redirect to login

- [x] **1.1.4** Basic profile storage and display
  - Create profiles table trigger for new users
  - Display user info in header after login
  - **Acceptance:** Logged-in user sees their name/email

- [x] **1.1.5** Configure Tailwind styling and design tokens
  - Set up color palette (Caldera/Ember theme)
  - Configure typography scale
  - Add custom utility classes
  - **Acceptance:** Design tokens documented in tailwind.config.ts

- [x] **1.1.6** Initial Vercel deployment
  - Connect repository to Vercel
  - Configure environment variables
  - Deploy to production
  - **Acceptance:** App accessible at vercel.app URL

**Day 1 Checkpoint:** Users can log in with Google, see authenticated state

### Day 2: Database & Basic Layout

- [x] **1.2.1** Run migrations for core database tables
  - Create all tables from ADR-005 schema
  - Enable pgvector extension
  - Set up Row Level Security policies
  - **Acceptance:** All tables exist with RLS enabled

- [x] **1.2.2** Configure Supabase client for frontend and API
  - Create typed Supabase client with database types
  - Generate TypeScript types from schema
  - Set up client for Server Components and API routes
  - **Acceptance:** Type-safe database queries work

- [x] **1.2.3** Build dashboard layout with navigation and sidebar
  - Create app shell with header, sidebar, main content
  - Add navigation links for all EOS sections
  - Mobile-responsive layout
  - **Acceptance:** Dashboard shell renders with navigation

- [x] **1.2.4** Create Button, Card, Input, Modal component primitives
  - Build reusable UI components
  - Apply Ember design tokens
  - Add loading and disabled states
  - **Acceptance:** Components documented and reusable

**Phase 1 Checkpoint:** Authenticated dashboard shell with navigation deployed

---

## Phase 2: V/TO + Rocks (Days 3-4)

**Goal:** Track the core EOS components

### Day 3: V/TO Management

- [x] **2.1.1** Finalize V/TO JSONB data structure
  - Define complete V/TO schema with all sections
  - Create TypeScript types
  - **Acceptance:** VTO type matches EOS standard

- [x] **2.1.2** Build V/TO API routes (CRUD)
  - GET /api/eos/vto - retrieve current V/TO
  - PUT /api/eos/vto - update V/TO
  - Version history tracking
  - **Acceptance:** API endpoints working with validation

- [ ] **2.1.3** Create V/TO display page
  - Read-only view of all V/TO sections
  - Organized by EOS component
  - **Acceptance:** Full V/TO visible on dashboard

- [ ] **2.1.4** Implement V/TO edit mode
  - Inline editing for each section
  - Auto-save with debounce
  - Optimistic updates
  - **Acceptance:** V/TO editable with auto-save

**Day 3 Checkpoint:** V/TO visible and editable in dashboard

### Day 4: Rocks Tracking

- [ ] **2.2.1** Build Rocks API routes (CRUD, status updates)
  - Full CRUD for Rocks
  - Status transition validation
  - **Acceptance:** Rocks API complete

- [ ] **2.2.2** Create Rocks list view
  - Current quarter Rocks with status badges
  - Filter by owner, status
  - **Acceptance:** Rocks list renders with filtering

- [ ] **2.2.3** Build Rock detail view
  - Milestones, notes, history
  - Progress updates
  - **Acceptance:** Rock details fully visible

- [ ] **2.2.4** Implement status workflow
  - On-track, Off-track, Complete states
  - Visual status indicators
  - **Acceptance:** Status changes work with UI feedback

- [ ] **2.2.5** Add owner assignment
  - Link Rocks to partners
  - Owner dropdown in forms
  - **Acceptance:** Rocks assigned to owners

**Phase 2 Checkpoint:** V/TO and Quarterly Rocks tracked with status and owners

---

## Phase 3: Scorecard + Issues (Days 5-6)

**Goal:** Weekly metrics and issue management

### Day 5: Scorecard

- [ ] **3.1.1** Build Metrics API (CRUD for metrics and entries)
  - Create/edit metrics with targets
  - Weekly entry submission
  - **Acceptance:** Metrics API complete

- [ ] **3.1.2** Create Scorecard weekly grid view
  - Weeks as columns, metrics as rows
  - Show targets and actuals
  - **Acceptance:** Scorecard grid renders

- [ ] **3.1.3** Implement data entry interface
  - Quick entry for weekly values
  - Batch entry mode
  - **Acceptance:** Data entry works smoothly

- [ ] **3.1.4** Add target indicators
  - Green/yellow/red visual status
  - Trend arrows
  - **Acceptance:** Visual status clear

**Day 5 Checkpoint:** Scorecard tracking with weekly data entry

### Day 6: Issues Management

- [ ] **3.2.1** Build Issues API (CRUD, prioritization)
  - Full CRUD for Issues
  - Priority ordering
  - **Acceptance:** Issues API complete

- [ ] **3.2.2** Create Issues list view
  - Sortable, filterable list
  - Priority indicators
  - **Acceptance:** Issues list with sorting

- [ ] **3.2.3** Implement IDS workflow
  - Identify, Discuss, Solve states
  - State transition UI
  - **Acceptance:** IDS workflow functional

- [ ] **3.2.4** Build Issue detail view
  - Full view with discussion notes
  - Resolution tracking
  - **Acceptance:** Issue details complete

**Phase 3 Checkpoint:** Issues tracked with IDS workflow, Scorecard functional

---

## Phase 4: To-dos + L10 Prep (Days 7-8)

**Goal:** Task tracking and meeting preparation

### Day 7: To-dos

- [ ] **4.1.1** Build To-dos API (CRUD, completion)
  - Full CRUD for To-dos
  - Completion toggle
  - **Acceptance:** To-dos API complete

- [ ] **4.1.2** Create To-dos list view
  - By owner, by due date views
  - Completion status
  - **Acceptance:** To-dos list renders

- [ ] **4.1.3** Implement quick add interface
  - Fast to-do creation
  - Inline add
  - **Acceptance:** Quick add works

- [ ] **4.1.4** Add completion tracking
  - Check off items
  - Rollover detection for overdue
  - **Acceptance:** Completion tracking works

- [ ] **4.1.5** Link to-dos to meetings
  - Associate to-dos with L10 outcomes
  - Meeting context visible
  - **Acceptance:** Meeting links work

**Day 7 Checkpoint:** To-do tracking with completion

### Day 8: L10 Meeting Prep

- [ ] **4.2.1** Create meeting data model
  - Store meeting metadata
  - Link to prep content
  - **Acceptance:** Meeting table created

- [ ] **4.2.2** Build AI prep generation
  - AI generates prep based on current EOS data
  - Personalized per partner
  - **Acceptance:** Prep generation works

- [ ] **4.2.3** Create prep display page
  - Meeting prep page with all sections
  - Per-partner view
  - **Acceptance:** Prep page renders

- [ ] **4.2.4** Set up scheduled job
  - Generate prep 2 days before L10
  - Vercel Cron job
  - **Acceptance:** Scheduled generation works

**Phase 4 Checkpoint:** Auto-generated L10 prep available before meetings

---

## Phase 5: Transcript Ingestion (Days 9-10)

**Goal:** Process meeting transcripts for context and insights

### Day 9: Transcript Upload

- [ ] **5.1.1** Build file upload interface
  - Accept .txt, .md transcript files
  - Drag-and-drop support
  - **Acceptance:** File upload works

- [ ] **5.1.2** Implement text extraction
  - Parse and clean transcript text
  - Handle various formats
  - **Acceptance:** Text extraction works

- [ ] **5.1.3** Create transcript storage
  - Save full transcript and metadata
  - Link to meeting
  - **Acceptance:** Transcripts stored

- [ ] **5.1.4** Build transcript list view
  - View all uploaded transcripts
  - Search and filter
  - **Acceptance:** Transcript list renders

- [ ] **5.1.5** Create transcript detail view
  - View full text with search
  - Highlight functionality
  - **Acceptance:** Transcript detail works

**Day 9 Checkpoint:** Transcripts uploadable and viewable

### Day 10: Transcript Analysis

- [ ] **5.2.1** Implement chunking
  - Split transcripts into searchable chunks
  - Speaker attribution
  - **Acceptance:** Chunking works

- [ ] **5.2.2** Generate embeddings
  - Create and store vector embeddings
  - pgvector integration
  - **Acceptance:** Embeddings stored

- [ ] **5.2.3** Build extraction pipeline
  - AI extracts decisions, issues, to-dos
  - Structured output
  - **Acceptance:** Extraction works

- [ ] **5.2.4** Link extractions to EOS
  - Create Issues/To-dos from extraction
  - User review before creation
  - **Acceptance:** Auto-creation works

**Phase 5 Checkpoint:** Transcripts processed, insights extracted

---

## Phase 6: EOS Coaching Layer (Days 11-12)

**Goal:** AI chat interface for coaching and questions

### Day 11: Chat Infrastructure

- [ ] **6.1.1** Build Chat API
  - Message handling endpoint
  - Context retrieval
  - **Acceptance:** Chat API works

- [ ] **6.1.2** Create Chat UI
  - Message list with streaming
  - Input with send
  - **Acceptance:** Chat UI functional

- [ ] **6.1.3** Implement context retrieval
  - Pull relevant transcripts and EOS data
  - Vector similarity search
  - **Acceptance:** Context retrieved

**Day 11 Checkpoint:** Basic chat working

### Day 12: Coaching Intelligence

- [ ] **6.2.1** Build Ember system prompt
  - Persona, EOS expertise, Caldera context
  - Partner profiles
  - **Acceptance:** System prompt complete

- [ ] **6.2.2** Implement RAG pipeline
  - Retrieve relevant context for questions
  - Combine with EOS data
  - **Acceptance:** RAG working

- [ ] **6.2.3** Create coaching prompts
  - Specific prompts for common scenarios
  - EOS methodology grounding
  - **Acceptance:** Coaching prompts work

- [ ] **6.2.4** Add private chat storage
  - User-specific chat history
  - Row-level security
  - **Acceptance:** Private chats work

**Phase 6 Checkpoint:** AI chat with EOS coaching and context awareness

---

## Phase 7: Polish + Launch (Days 13-14)

**Goal:** Production-ready for first real L10

### Day 13: Integration & Testing

- [ ] **7.1.1** End-to-end testing
  - Full workflow verification
  - All features tested
  - **Acceptance:** E2E tests pass

- [ ] **7.1.2** Bug fixes
  - Address issues from testing
  - Edge case handling
  - **Acceptance:** Known bugs fixed

- [ ] **7.1.3** Performance optimization
  - Optimize slow queries
  - Add caching where needed
  - **Acceptance:** Performance acceptable

**Day 13 Checkpoint:** All features working, tests passing

### Day 14: Launch Prep

- [ ] **7.2.1** Final deployment
  - Production environment verified
  - All env vars set
  - **Acceptance:** Production deployed

- [ ] **7.2.2** Seed data
  - Import V/TO and historical context
  - Partner profiles created
  - **Acceptance:** Initial data loaded

- [ ] **7.2.3** User documentation
  - Brief user guide
  - Key workflows documented
  - **Acceptance:** Docs complete

- [ ] **7.2.4** Demo walkthrough
  - Demo with Rich
  - Gather feedback
  - **Acceptance:** Demo complete

- [ ] **7.2.5** Go live
  - Enable for first L10
  - Monitor for issues
  - **Acceptance:** Ember live

**Phase 7 Checkpoint:** Ember live and ready for first L10

---

## Task Log

| Date | Task ID | Description | Status |
|------|---------|-------------|--------|
| 2026-01-31 | 1.1.1 | Create Next.js project with TypeScript | Complete |
| 2026-01-31 | 1.1.2 | Configure Supabase project and auth | Complete |
| 2026-01-31 | 1.1.3 | Implement Google OAuth flow and protected routes | Complete |
| 2026-01-31 | 1.1.4 | Basic profile storage and display | Complete |
| 2026-01-31 | 1.1.5 | Configure Tailwind styling and design tokens | Complete |
| 2026-01-31 | 1.1.6 | Initial Vercel deployment | Complete |
| 2026-01-31 | 1.2.1 | Run migrations for core database tables | Complete |
| 2026-01-31 | 1.2.2 | Configure Supabase client for frontend and API | Complete |
| 2026-01-31 | 1.2.3 | Build dashboard layout with navigation and sidebar | Complete |
| 2026-01-31 | 1.2.4 | Create Button, Card, Input, Modal component primitives | Complete |

---

## Notes

- Tasks should be completed in order within each phase
- Each phase has a checkpoint that must be verified before proceeding
- Update this file as tasks are completed
- Add blockers and notes in the Task Log
