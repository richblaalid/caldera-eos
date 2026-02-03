# ADR Clarifying Questions

This file contains **starting point questions** for ADR discussions. These are not rigid scripts - adapt based on the conversation and the specific context.

## How to Use This File

1. **For PRD Section 8 ADRs**: Use the predefined questions below as a starting point
2. **For Implicit PRD Decisions**: Focus on "why was this chosen?" and "what alternatives were considered?"
3. **For New Decisions**: Define the problem first, then explore options organically

## General Questions (Any ADR)

These work for any architectural decision:

- "What problem are we solving with this decision?"
- "What are the key constraints we need to work within?"
- "Are there existing patterns in the codebase we should follow?"
- "What would trigger us to revisit this decision later?"
- "Who else should be consulted on this decision?"

## Questions for Implicit PRD Decisions (Category B)

When documenting a choice already made in the PRD:

- "The PRD specifies [X]. What drove this decision?"
- "Were there specific requirements that ruled out alternatives?"
- "What are the trade-offs we're accepting with this choice?"
- "Are there any concerns or risks with this approach?"
- "Under what circumstances would we reconsider?"

---

## PRD Section 8 ADR Questions

These are starting points for the 10 predefined ADRs:

## ADR-0001: Database ORM Choice

**Options:** Drizzle vs Prisma vs raw SQL

1. **Type Safety Priority**
   - Question: "How important is compile-time type safety for database queries?"
   - Options: Critical (errors must be caught at build time) | Important (nice to have) | Not a priority

2. **Team Experience**
   - Question: "What's the team's experience with these ORMs?"
   - Options: Familiar with Drizzle | Familiar with Prisma | Prefer raw SQL | No strong preference

3. **Migration Strategy**
   - Question: "How do you want to handle schema migrations?"
   - Options: Code-first with auto-migration | SQL-first with version control | Hybrid approach

4. **Query Complexity**
   - Question: "Will you need complex queries (CTEs, window functions, raw SQL)?"
   - Options: Frequently | Sometimes | Rarely

5. **Bundle Size Concern**
   - Question: "Is client-side bundle size a concern for this project?"
   - Options: Yes, minimize deps | Not a major concern

---

## ADR-0002: Background Job Processing

**Options:** In-process vs separate worker vs BullMQ

1. **Job Volume**
   - Question: "What's the expected job volume?"
   - Options: Low (<100/day) | Medium (100-1000/day) | High (1000+/day)

2. **Reliability Requirement**
   - Question: "Do background jobs need guaranteed delivery?"
   - Options: Yes, jobs must never be lost | Best-effort is acceptable

3. **Deployment Model**
   - Question: "How do you want to deploy workers?"
   - Options: Same container as app | Separate worker process | Serverless functions

4. **Job Complexity**
   - Question: "What types of background jobs do you anticipate?"
   - Options: Simple tasks (emails, cleanup) | Document processing | Complex workflows | Mix of all

5. **Monitoring Needs**
   - Question: "How important is job queue visibility and monitoring?"
   - Options: Critical (need dashboard) | Nice to have | Not important

---

## ADR-0003: Real-time Updates

**Options:** WebSockets vs Server-Sent Events vs polling

1. **Bidirectional Needs**
   - Question: "Do you need real-time communication from client to server?"
   - Options: Yes (collaborative editing) | No (server-to-client only) | Uncertain

2. **Connection Scale**
   - Question: "How many concurrent real-time connections per instance?"
   - Options: <50 | 50-200 | 200+

3. **Reconnection Importance**
   - Question: "How critical is automatic reconnection handling?"
   - Options: Critical (must be seamless) | Important | Can tolerate manual refresh

4. **Infrastructure Constraints**
   - Question: "Any infrastructure constraints (proxies, load balancers)?"
   - Options: Standard cloud setup | Corporate proxies possible | Unknown

5. **Complexity Budget**
   - Question: "How much complexity are you willing to add for real-time?"
   - Options: Keep it simple | Moderate complexity OK | Whatever works best

---

## ADR-0004: File Processing Pipeline

**Options:** Sync in request vs async queue

1. **User Experience Priority**
   - Question: "What UX do you want for document uploads?"
   - Options: Upload completes when processing done | Upload fast, process in background

2. **File Sizes**
   - Question: "What's the expected range of document sizes?"
   - Options: Small (<1MB) | Medium (1-10MB) | Large (10MB+) | Mix

3. **Processing Time Tolerance**
   - Question: "How long can users wait for documents to be searchable?"
   - Options: Immediate | <1 minute | <5 minutes | Doesn't matter

4. **Error Handling**
   - Question: "How should processing failures be handled?"
   - Options: Fail fast, notify user | Retry automatically | Queue for manual review

5. **Progress Visibility**
   - Question: "Do users need real-time processing progress?"
   - Options: Yes, detailed progress | Simple status (processing/done) | Not needed

---

## ADR-0005: Embedding Model Selection

**Options:** OpenAI ada-002 vs Anthropic vs open source

1. **Cost Sensitivity**
   - Question: "How sensitive is the project to embedding generation costs?"
   - Options: Cost is primary concern | Balance cost and quality | Quality first

2. **Latency Requirements**
   - Question: "What's acceptable latency for embedding generation?"
   - Options: <100ms | <500ms | <2s | Async is fine

3. **Vendor Lock-in Concern**
   - Question: "How concerned are you about vendor lock-in?"
   - Options: Want to avoid lock-in | Acceptable for good service | Not concerned

4. **Self-hosting Interest**
   - Question: "Any interest in self-hosting embedding models?"
   - Options: Yes, for privacy/cost | Maybe in future | No, prefer managed

5. **Quality Requirements**
   - Question: "How critical is retrieval accuracy for your use case?"
   - Options: Critical (legal/medical) | Important | Good enough is fine

---

## ADR-0006: Chunk Strategy

**Options:** Fixed size vs semantic vs hybrid

1. **Document Types**
   - Question: "What are the primary document types?"
   - Options: Structured (contracts, forms) | Narrative (reports, articles) | Technical (code, specs) | Mixed

2. **Query Patterns**
   - Question: "How will users typically query documents?"
   - Options: Specific facts | Broad concepts | Both equally

3. **Context Needs**
   - Question: "How much surrounding context is needed for good answers?"
   - Options: Single paragraph | Full section | Multiple sections

4. **Structure Preservation**
   - Question: "How important is preserving document structure (headings, sections)?"
   - Options: Critical | Nice to have | Not important

5. **Processing Complexity**
   - Question: "What's your tolerance for chunking complexity?"
   - Options: Keep simple | Moderate complexity OK | Best results matter most

---

## ADR-0007: Plugin Sandboxing

**Options:** VM isolation vs permission-based vs process isolation

1. **Trust Model**
   - Question: "Who will create plugins for Charter Pro?"
   - Options: Only your team | Vetted partners | Any developer

2. **Resource Access**
   - Question: "What resources do plugins need access to?"
   - Options: Read-only data | Read/write data | External APIs | All of above

3. **Security Priority**
   - Question: "How paranoid should we be about plugin security?"
   - Options: Maximum isolation | Reasonable precautions | Trust but verify

4. **Developer Experience**
   - Question: "How important is plugin development ease?"
   - Options: Critical (want ecosystem) | Important | Secondary to security

5. **Performance Budget**
   - Question: "Acceptable overhead for plugin sandboxing?"
   - Options: Minimal (<10ms) | Moderate (10-50ms) | Whatever needed

---

## ADR-0008: State Management

**Options:** React Query vs SWR vs Zustand

1. **State Type**
   - Question: "What's the primary state management need?"
   - Options: Server state (API data) | Client state (UI) | Both equally

2. **Caching Requirements**
   - Question: "How sophisticated does caching need to be?"
   - Options: Simple cache | Intelligent invalidation | Optimistic updates

3. **Offline Support**
   - Question: "Do you need offline support?"
   - Options: Yes, must work offline | Nice to have | Not needed

4. **DevTools Importance**
   - Question: "How important are debugging/devtools?"
   - Options: Critical | Nice to have | Not important

5. **Learning Curve**
   - Question: "Team's familiarity with these libraries?"
   - Options: Know React Query | Know SWR | Know Zustand | None

---

## ADR-0009: Testing Strategy

**Options:** Unit vs integration focus, E2E tooling

1. **Coverage Goals**
   - Question: "What's your target test coverage?"
   - Options: >80% | >60% | Critical paths only

2. **Test Speed Priority**
   - Question: "How important is fast test execution?"
   - Options: Critical (<30s) | Important (<2min) | Comprehensive > speed

3. **E2E Scope**
   - Question: "Which flows need E2E testing?"
   - Options: Auth + core chat only | All user flows | Critical business flows

4. **Visual Testing**
   - Question: "Do you need visual regression testing?"
   - Options: Yes | Maybe later | No

5. **CI Infrastructure**
   - Question: "What CI/CD platform will you use?"
   - Options: GitHub Actions | Other CI | Not decided yet

---

## ADR-0010: Monorepo Structure

**Options:** Single package vs workspace structure

1. **Team Size**
   - Question: "How many developers will work on this codebase?"
   - Options: 1-2 | 3-5 | 5+

2. **Deployment Model**
   - Question: "How will you deploy the application?"
   - Options: Single container | Multiple services | Serverless

3. **Code Sharing**
   - Question: "How much code will be shared between packages?"
   - Options: Heavy (types, utils, components) | Moderate | Minimal

4. **Build Time Concern**
   - Question: "Are you concerned about build times?"
   - Options: Yes, want incremental builds | Somewhat | Full rebuilds OK

5. **Package Manager Preference**
   - Question: "Do you have a package manager preference?"
   - Options: pnpm | npm | yarn | No preference
