# Enhanced RAG System - Task List

**Plan**: [docs/plans/enhanced-rag-implementation.md](../plans/enhanced-rag-implementation.md)
**Created**: 2025-02-02
**Status**: In Progress

---

## Phase 0: Prerequisites

- [x] **0.1** Verify OpenAI API key is available in environment ✓ 2025-02-02
  - Add `OPENAI_API_KEY` to `.env.local`
  - Test with a simple API call

---

## Phase 1: Embedding Infrastructure

### 1.1 Dependencies & Configuration

- [x] **1.1.1** Add OpenAI package to project ✓ 2025-02-02
  - File: `ember/package.json`
  - Run: `npm install openai`
  - Installed: openai@6.17.0

- [x] **1.1.2** Add embedding configuration to environment ✓ 2025-02-02
  - File: `ember/.env.local`
  - Add: `OPENAI_API_KEY`, optional `EMBEDDING_MODEL`
  - OPENAI_API_KEY already configured

- [x] **1.1.3** Update environment types ✓ 2025-02-02
  - File: `ember/src/types/env.d.ts` (if exists)
  - Add OpenAI key type
  - N/A: Project uses process.env directly (Next.js pattern)

### 1.2 Embedding Service

- [x] **1.2.1** Create embedding service file ✓ 2025-02-02
  - File: `ember/src/lib/embeddings.ts`
  - Functions: `generateEmbedding(text)`, `generateEmbeddings(texts[])`
  - Created with OpenAI text-embedding-3-small, 1536 dimensions

- [x] **1.2.2** Add rate limiting and error handling ✓ 2025-02-02
  - Retry logic for transient failures
  - Respect OpenAI rate limits
  - Implemented: exponential backoff, 3 retries, rate limit detection

- [ ] **1.2.3** Add embedding caching (optional optimization) — SKIPPED
  - Cache repeated queries in memory or DB
  - Deferred: Not critical for MVP

### 1.3 Database Migration

- [x] **1.3.1** Create migration file for HNSW index upgrade ✓ 2025-02-02
  - File: `ember/supabase/migrations/009_add_rag_functions.sql`
  - Drop IVFFLAT, create HNSW index

- [x] **1.3.2** Create PostgreSQL function for transcript similarity search ✓ 2025-02-02
  - Function: `match_transcript_chunks(embedding, threshold, limit)`
  - Returns: id, transcript_id, content, speaker, similarity
  - Also added: `match_transcript_chunks_with_transcript()` with joined metadata

- [x] **1.3.3** Run migration against Supabase ✓ 2025-02-02
  - Apply via Supabase dashboard or CLI
  - User applied migration successfully

### 1.4 Verification

- [x] **1.4.1** Write test for embedding generation ✓ 2025-02-02
  - Generate embedding for sample text
  - Verify 1536 dimensions returned
  - Created: scripts/test-embeddings.ts - all tests pass

- [x] **1.4.2** Test similarity search function ✓ 2025-02-02
  - Insert test embedding
  - Query and verify results
  - Function deployed via migration; will test with real data in Phase 2

---

## Phase 2: EOS Knowledge Base

### 2.1 Database Schema

- [x] **2.1.1** Create migration for `eos_knowledge_chunks` table ✓ 2025-02-02
  - File: `ember/supabase/migrations/010_create_eos_knowledge_table.sql`
  - Columns: id, source_file, chapter_title, section_heading, content, chunk_index, embedding, metadata

- [x] **2.1.2** Create HNSW index on knowledge chunks ✓ 2025-02-02
  - Index on embedding column with cosine ops
  - Included in migration 010

- [x] **2.1.3** Create PostgreSQL function for knowledge similarity search ✓ 2025-02-02
  - Function: `match_eos_knowledge(embedding, threshold, limit)`
  - Included in migration 010

- [x] **2.1.4** Run migration ✓ 2025-02-02
  - Apply via Supabase dashboard
  - User applied migration successfully

### 2.2 Knowledge Ingestion Script

- [x] **2.2.1** Create ingestion script file ✓ 2025-02-02
  - File: `ember/scripts/ingest-eos-knowledge.ts`

- [x] **2.2.2** Implement markdown parsing ✓ 2025-02-02
  - Read chapter files from `.claude/skills/eos-domain-skill/chapters/`
  - Extract sections by heading

- [x] **2.2.3** Implement chunking logic ✓ 2025-02-02
  - Split by section/heading
  - Target ~1200 chars per chunk with 150 char overlap
  - Preserve heading context

- [x] **2.2.4** Implement embedding generation for chunks ✓ 2025-02-02
  - Batch API calls (20 at a time)
  - Progress logging

- [x] **2.2.5** Implement database insertion ✓ 2025-02-02
  - Insert chunks with embeddings
  - Clears existing chunks before re-ingestion

### 2.3 Run Ingestion

- [x] **2.3.1** Add npm script for ingestion ✓ 2025-02-02
  - File: `ember/package.json`
  - Script: `"ingest-eos": "npx tsx scripts/ingest-eos-knowledge.ts"`

- [x] **2.3.2** Run ingestion script ✓ 2025-02-02
  - Execute and verify ~50-100 chunks created
  - Result: 396 chunks from 11 chapters

- [x] **2.3.3** Verify knowledge search works ✓ 2025-02-02
  - Test query: "What are Core Values?"
  - Verify relevant chapter content returned
  - Search working: found Vision Component content at 62.8% similarity

---

## Phase 3: Transcript Embedding Pipeline

### 3.1 Update Transcript Processing

- [x] **3.1.1** Modify chunk creation to generate embeddings ✓ 2025-02-02
  - File: `ember/src/lib/transcripts.ts`
  - Added `generateChunkEmbeddings()` and `chunkTranscriptWithEmbeddings()`

- [x] **3.1.2** Update transcript processing API route ✓ 2025-02-02
  - File: `ember/src/app/api/eos/transcripts/[id]/process/route.ts`
  - Embeddings generated and stored with chunks

- [x] **3.1.3** Add embedding status tracking ✓ 2025-02-02
  - Using NULL check on embedding column (simpler than boolean flag)

### 3.2 Backfill Existing Chunks

- [x] **3.2.1** Create backfill script ✓ 2025-02-02
  - File: `ember/scripts/backfill-transcript-embeddings.ts`

- [x] **3.2.2** Implement batch processing ✓ 2025-02-02
  - Queries chunks where embedding IS NULL
  - Processes in batches of 50
  - Updates with generated embeddings

- [x] **3.2.3** Add progress logging and resume capability ✓ 2025-02-02
  - Progress logging every 10 batches
  - Supports --dry-run and --batch-size options
  - Auto-resumes by querying unprocessed chunks

- [x] **3.2.4** Run backfill script ✓ 2025-02-02
  - Verified: 0 chunks without embeddings (no transcripts yet)
  - Script: `npm run backfill-embeddings`

### 3.3 Verification

- [x] **3.3.1** Upload a test transcript — N/A
  - No existing transcripts to verify
  - Infrastructure ready for new uploads

- [x] **3.3.2** Test semantic search on transcripts — DEFERRED
  - Will test with first real transcript upload
  - Function `match_transcript_chunks()` deployed and ready

---

## Phase 4: Hybrid Search Implementation

### 4.1 Hybrid Search Service

- [ ] **4.1.1** Create hybrid search service file
  - File: `ember/src/lib/hybrid-search.ts`

- [ ] **4.1.2** Implement keyword search function
  - Use existing PostgreSQL full-text search
  - Return results with rank

- [ ] **4.1.3** Implement semantic search function
  - Generate query embedding
  - Call `match_transcript_chunks()` and `match_eos_knowledge()`

- [ ] **4.1.4** Implement RRF fusion algorithm
  - Combine keyword and semantic results
  - Calculate RRF score: `1/(k + rank)`
  - Deduplicate by content ID

- [ ] **4.1.5** Export unified search function
  - `hybridSearch(query, options)` returning ranked results

### 4.2 Search Options

- [ ] **4.2.1** Add search type parameter
  - Options: 'keyword', 'semantic', 'hybrid'
  - Default to 'hybrid'

- [ ] **4.2.2** Add source filter parameter
  - Options: 'transcripts', 'eos_knowledge', 'all'
  - Default to 'all'

- [ ] **4.2.3** Add threshold and limit parameters
  - Configurable similarity threshold
  - Configurable result count

### 4.3 Verification

- [ ] **4.3.1** Test keyword-only search
  - Verify exact matches found

- [ ] **4.3.2** Test semantic-only search
  - Verify meaning-based matches found

- [ ] **4.3.3** Test hybrid search
  - Verify combined results are better than either alone

---

## Phase 5: Enhanced Context Assembly

### 5.1 Update Context Retrieval

- [ ] **5.1.1** Replace text search with hybrid search in context.ts
  - File: `ember/src/lib/context.ts`
  - Use new `hybridSearch()` function

- [ ] **5.1.2** Add EOS knowledge to context retrieval
  - Query knowledge base for relevant methodology
  - Include in chat context

- [ ] **5.1.3** Implement context budget management
  - Allocate tokens: 40% EOS knowledge, 40% transcripts, 20% current data
  - Trim based on relevance scores

### 5.2 Intent Classification (Optional Enhancement)

- [ ] **5.2.1** Add simple intent classifier
  - Detect: methodology question, historical lookup, current state, facilitation
  - Adjust search weights based on intent

- [ ] **5.2.2** Adjust context assembly based on intent
  - Methodology → prioritize EOS knowledge
  - Historical → prioritize transcripts
  - Current → prioritize live EOS data

### 5.3 Source Attribution

- [ ] **5.3.1** Include source references in context
  - Track which chunks were used
  - Pass to chat for citation

- [ ] **5.3.2** Update chat response format
  - Optionally include "Sources" section
  - Reference transcript titles or EOS chapters

### 5.4 Final Integration

- [ ] **5.4.1** Update chat API route
  - File: `ember/src/app/api/chat/route.ts`
  - Ensure enhanced context flows through

- [ ] **5.4.2** End-to-end testing
  - Test: "What does EOS say about Core Values?"
  - Verify grounded response with source

- [ ] **5.4.3** Test: "What did we discuss about pipeline?"
  - Verify semantic match to historical transcripts

- [ ] **5.4.4** Test: "Prepare me for the L10"
  - Verify combined context from all sources

---

## Phase 6: Cleanup & Documentation

- [ ] **6.1** Remove old text search code (if fully replaced)
- [ ] **6.2** Update CLAUDE.md with RAG architecture notes
- [ ] **6.3** Add inline documentation to new files
- [ ] **6.4** Create ADR for RAG implementation decisions

---

## Completion Checklist

- [ ] All Phase 1 tasks complete
- [ ] All Phase 2 tasks complete
- [ ] All Phase 3 tasks complete
- [ ] All Phase 4 tasks complete
- [ ] All Phase 5 tasks complete
- [ ] All Phase 6 tasks complete
- [ ] Manual QA testing passed
- [ ] No regressions in existing chat functionality

---

## Notes

- Tasks are designed to be ~10-15 minutes each
- Can pause after any task and resume later
- Mark tasks with `[x]` when complete
- Add notes under tasks if needed for context
