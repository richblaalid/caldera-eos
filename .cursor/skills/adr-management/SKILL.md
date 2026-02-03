---
description: Manage Architecture Decision Records for Charter Pro - identify, discuss, and document architectural choices
---

# ADR Management Skill

## Overview

This skill helps identify, discuss, and document Architecture Decision Records (ADRs) for Charter Pro. It supports:

1. **Working through predefined ADRs** from PRD Section 8 (the "open questions")
2. **Identifying new ADRs** from decisions already made in the PRD but not formally documented
3. **Creating ADRs for any architectural decision** as they arise during development

## ADR Categories

### Category A: Open Questions (PRD Section 8)

These are explicitly marked as needing decisions:

| #   | Title                     | Options from PRD                                      |
| --- | ------------------------- | ----------------------------------------------------- |
| 001 | Database ORM choice       | Drizzle vs Prisma vs raw SQL                          |
| 002 | Background job processing | In-process vs separate worker vs BullMQ               |
| 003 | Real-time updates         | WebSockets vs SSE vs polling                          |
| 004 | File processing pipeline  | Sync in request vs async queue                        |
| 005 | Embedding model selection | OpenAI ada-002 vs Anthropic vs open source            |
| 006 | Chunk strategy            | Fixed size vs semantic vs hybrid                      |
| 007 | Plugin sandboxing         | VM isolation vs permission-based vs process isolation |
| 008 | State management          | React Query vs SWR vs Zustand                         |
| 009 | Testing strategy          | Unit vs integration focus, E2E tooling                |
| 010 | Monorepo structure        | Single package vs workspace structure                 |

### Category B: Implicit Decisions (stated in PRD but not formally documented)

These choices appear in PRD Section 2.1 but lack ADR documentation:

| Topic          | PRD Choice             | Alternatives Worth Documenting            |
| -------------- | ---------------------- | ----------------------------------------- |
| Web Framework  | Next.js 14+ App Router | Pages Router, Remix, SvelteKit            |
| Authentication | BetterAuth             | NextAuth, Clerk, Auth0, Lucia             |
| Database       | PostgreSQL 15+         | MySQL, SQLite, MongoDB                    |
| Vector Search  | pgvector               | Pinecone, Weaviate, Qdrant, Chroma        |
| Styling        | Tailwind CSS           | CSS Modules, styled-components, Panda CSS |
| File Storage   | Filesystem/S3          | Cloudflare R2, GCS, local-only            |

### Category C: Emerging Decisions

New architectural decisions that arise during development (not predefined).

## Workflow Modes

### Mode 1: `/adr` or `/adr status`

Show current ADR status - what's documented, what's pending.

### Mode 2: `/adr next`

Work on the next pending ADR from Category A (the PRD open questions).

### Mode 3: `/adr new [topic]`

Create a new ADR for any topic. Use this for:

- Documenting implicit PRD decisions (Category B)
- New decisions that arise during development (Category C)

### Mode 4: `/adr [number]`

Work on a specific ADR by number.

### Mode 5: `/adr identify`

Scan PRD.md and product-plan.md to identify decisions that should have ADRs but don't yet. This helps find Category B items.

## Detailed Workflow

### Step 1: Check Current Status

```
1. Glob for docs/adrs/ADR-*.md files
2. For each found file, read the frontmatter to get status
3. Categorize: Which are from PRD Section 8? Which are new?
4. Report summary of all ADRs and their status
```

### Step 2: Gather Context for the Selected ADR

Read these files and extract relevant information:

**From `docs/PRD.md`:**

- Section 2.1: Technology Stack (for tech decisions)
- Section 2.2: Environment Configuration (for infrastructure decisions)
- Section 2.3: Database Schema Overview (for data decisions)
- Section 4: API Requirements (for interface decisions)
- Section 5: Non-Functional Requirements (for quality decisions)
- Section 8: The specific ADR's description

**From `docs/product-plan.md`:**

- Phase 1 features and timeline
- Target market (SMBs, 10-50 employees)
- Design principles (single-tenant, configuration over code, etc.)

### Step 3: Present the Decision

Format your presentation:

```markdown
## ADR-00X: [Title]

### What We're Deciding

[Brief explanation of the architectural decision needed]

### Why It Matters for Charter Pro

[Connect to PRD requirements and business goals]

### Options

1. **[Option A]** - [Brief description]
2. **[Option B]** - [Brief description]
3. **[Option C]** - [Brief description]

### Relevant PRD Context

- [Key requirement 1]
- [Key requirement 2]
- [Design principle that applies]

### Questions to Help Decide

[Use questions from QUESTIONS.md]
```

### Step 4: Ask Clarifying Questions

Use the `AskUserQuestion` tool to gather input. Reference the questions in `QUESTIONS.md` for each specific ADR. Typically ask 3-5 questions covering:

- Technical constraints
- Team experience/preferences
- Performance requirements
- Integration considerations
- Timeline/priority factors

### Step 5: Analyze and Recommend

Based on user answers and PRD context:

1. **Evaluate each option** against:
   - PRD requirements (what does the document say?)
   - User's answers (what are their constraints/preferences?)
   - Best practices (what does the industry recommend?)

2. **Make a clear recommendation** with reasoning

3. **Confirm with user** before generating the ADR

### Step 6: Generate the ADR Document

Use the template from `TEMPLATE.md` to create:

```
docs/adrs/ADR-{NNNN}-{kebab-case-title}.md
```

File naming examples:

- `ADR-0001-database-orm-choice.md`
- `ADR-0002-background-job-processing.md`

Key sections to fill:

- **Status**: `accepted`
- **Date**: Today's date (YYYY-MM-DD)
- **Context**: Summarize why this decision was needed
- **Decision Drivers**: List from user answers and PRD
- **Options**: All considered with pros/cons
- **Decision**: The chosen option with justification
- **Consequences**: Good, bad, and neutral impacts

### Step 7: Update Tracking

Edit `docs/adrs/README.md`:

1. Update the status from "Pending" to "Accepted"
2. Add the date
3. Update the progress count

## ADR Dependencies

Some ADRs inform others. Consider these relationships:

- **ADR-001 (ORM)** → Affects ADR-009 (Testing - how to test DB)
- **ADR-002 (Background jobs)** → Affects ADR-004 (File processing)
- **ADR-003 (Real-time)** → Affects ADR-008 (State management)
- **ADR-005 (Embeddings)** → Affects ADR-006 (Chunk strategy)
- **ADR-010 (Monorepo)** → Should be decided early, affects project structure

Despite dependencies, work through ADRs in sequential order (001-010) for consistency.

## Handling Different ADR Types

### For PRD Section 8 ADRs (Category A)

Use the predefined questions in `QUESTIONS.md` as a starting point, but adapt based on conversation.

### For Implicit PRD Decisions (Category B)

When documenting a decision already made in the PRD:

1. **Acknowledge the current choice** - "The PRD specifies X"
2. **Explore the reasoning** - Ask why this choice was made
3. **Document alternatives considered** - Even if briefly
4. **Record the rationale** - Why X over Y and Z?
5. **Note any conditions for revisiting** - When might we reconsider?

Example questions for Category B ADRs:

- "The PRD chose [X]. What drove this decision?"
- "Were there specific requirements that ruled out alternatives?"
- "Are there any concerns or trade-offs with this choice?"
- "Under what circumstances would we revisit this decision?"

### For New Decisions (Category C)

When a new architectural decision arises:

1. **Define the problem** - What are we deciding and why now?
2. **Identify options** - What are the reasonable alternatives?
3. **Gather context** - How does this relate to existing decisions?
4. **Evaluate trade-offs** - Pros/cons of each option
5. **Make recommendation** - Based on PRD principles and constraints

## Tips for Specific ADRs

### PRD Section 8 ADRs

| ADR                 | Key Context                                     | Key Considerations                     |
| ------------------- | ----------------------------------------------- | -------------------------------------- |
| 001 ORM             | PRD suggests Drizzle, PostgreSQL 15+ required   | Type safety, migrations, raw SQL needs |
| 002 Background Jobs | REQ-PROC-001 async processing, single container | Reliability, monitoring, complexity    |
| 003 Real-time       | REQ-MSG-001 streaming, Phase 2 multi-user       | SSE vs WebSocket, reconnection         |
| 004 File Processing | REQ-PROC-001 async, REQ-DOC-002 progress        | UX vs complexity, error handling       |
| 005 Embeddings      | pgvector(1536), cost sensitivity                | Quality, latency, vendor lock-in       |
| 006 Chunking        | REQ-PROC-003/004 semantic, 500-1000 tokens      | Document types, query patterns         |
| 007 Plugin Sandbox  | Phase 2+, limited API access                    | Security vs DX trade-off               |
| 008 State Mgmt      | Real-time needs, server vs client state         | Caching, optimistic updates            |
| 009 Testing         | REQ-PERF verification needed                    | Speed vs coverage, E2E scope           |
| 010 Monorepo        | Single container deployment                     | Build complexity, code org             |

### Implicit PRD Decisions (Potential Category B ADRs)

| Topic              | PRD Choice    | Questions to Explore                        |
| ------------------ | ------------- | ------------------------------------------- |
| BetterAuth         | Auth library  | Why not NextAuth? Self-hosting needs?       |
| Next.js App Router | Framework     | Why App Router over Pages? SSR needs?       |
| PostgreSQL         | Database      | Why not SQLite for simplicity? Scale needs? |
| pgvector           | Vector search | Why not managed Pinecone? Cost/control?     |
| Tailwind           | Styling       | Design system needs? Component library?     |

## ADR Numbering

- **0001-0099**: Reserved for PRD Section 8 decisions
- **0100-0199**: Implicit PRD decisions (Category B)
- **0200+**: New decisions as they arise (Category C)

This keeps the original 10 ADRs in their expected positions while allowing growth.
