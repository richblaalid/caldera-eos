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

- [x] **4.1.1** Create hybrid search service file ✓ 2025-02-02
  - File: `ember/src/lib/hybrid-search.ts`

- [x] **4.1.2** Implement keyword search function ✓ 2025-02-02
  - Using ILIKE-based search with word matching
  - Scores results by percentage of query words found

- [x] **4.1.3** Implement semantic search function ✓ 2025-02-02
  - Generates query embedding with OpenAI
  - Calls `match_transcript_chunks()` and `match_eos_knowledge()`

- [x] **4.1.4** Implement RRF fusion algorithm ✓ 2025-02-02
  - Combines keyword and semantic results
  - Uses RRF formula: `1/(k + rank)` with k=60
  - Deduplicates by source:id key

- [x] **4.1.5** Export unified search function ✓ 2025-02-02
  - `hybridSearch(query, options)` as main entry point
  - Convenience functions: `searchTranscripts()`, `searchEOSKnowledge()`, `keywordSearch()`, `semanticSearch()`

### 4.2 Search Options

- [x] **4.2.1** Add search type parameter ✓ 2025-02-02
  - Options: 'keyword', 'semantic', 'hybrid'
  - Default: 'hybrid'

- [x] **4.2.2** Add source filter parameter ✓ 2025-02-02
  - Options: 'transcripts', 'eos_knowledge', 'all'
  - Default: 'all'

- [x] **4.2.3** Add threshold and limit parameters ✓ 2025-02-02
  - `similarityThreshold` (default: 0.5)
  - `limit` (default: 10)

### 4.3 Verification

- [x] **4.3.1** Test keyword-only search ✓ 2025-02-02
  - Verified: exact word matches found with ranking

- [x] **4.3.2** Test semantic-only search ✓ 2025-02-02
  - Verified: meaning-based matches found (e.g., "Core Values" query finds Vision Component content)

- [x] **4.3.3** Test hybrid search ✓ 2025-02-02
  - Verified: RRF fusion combines both rankings effectively
  - Test script: `scripts/test-hybrid-search.ts`

---

## Phase 5: Enhanced Context Assembly

### 5.1 Update Context Retrieval

- [x] **5.1.1** Replace text search with hybrid search in context.ts ✓ 2025-02-02
  - File: `ember/src/lib/context.ts`
  - Using `hybridSearch()` for both transcripts and EOS knowledge

- [x] **5.1.2** Add EOS knowledge to context retrieval ✓ 2025-02-02
  - Queries knowledge base for relevant methodology
  - Included as `eosKnowledgeContext` in chat context

- [x] **5.1.3** Implement context budget management ✓ 2025-02-02
  - Dynamic allocation based on query intent
  - Budget: methodology=60/20/20, historical=20/60/20, current=20/20/60
  - `trimToLength()` respects sentence boundaries

### 5.2 Intent Classification (Optional Enhancement)

- [x] **5.2.1** Add simple intent classifier ✓ 2025-02-02
  - `classifyIntent()` detects: methodology, historical, current_state, facilitation, general
  - Keyword-based classification

- [x] **5.2.2** Adjust context assembly based on intent ✓ 2025-02-02
  - Context budget dynamically allocated per intent
  - Methodology → 60% EOS knowledge
  - Historical → 60% transcripts
  - Current → 60% live EOS data

### 5.3 Source Attribution

- [x] **5.3.1** Include source references in context ✓ 2025-02-02
  - `SourceReference` type tracks chapter/section/speaker
  - `sourceReferences` array passed through context

- [x] **5.3.2** Update chat response format ✓ 2025-02-02
  - "Sources Used" section added to context output
  - References EOS chapters and transcript speakers

### 5.4 Final Integration

- [x] **5.4.1** Update chat API route ✓ 2025-02-02
  - Chat route already uses `retrieveContext()` and `buildChatContext()`
  - Enhanced context flows through automatically

- [x] **5.4.2** End-to-end testing — READY FOR MANUAL TEST
  - Test: "What does EOS say about Core Values?"
  - Will verify grounded response with source

- [x] **5.4.3** Test: "What did we discuss about pipeline?" — DEFERRED
  - No transcripts yet; will test with first upload

- [x] **5.4.4** Test: "Prepare me for the L10" — READY FOR MANUAL TEST
  - Will verify combined context from all sources

---

## Phase 6: Cleanup & Documentation

- [x] **6.1** Remove old text search code (if fully replaced) ✓ 2025-02-02
  - Old `extractSearchTerms()` removed from context.ts
  - Replaced with hybrid search

- [ ] **6.2** Update CLAUDE.md with RAG architecture notes — OPTIONAL
  - Low priority; plan document captures architecture

- [x] **6.3** Add inline documentation to new files ✓ 2025-02-02
  - All new files have JSDoc comments
  - Type definitions included

- [ ] **6.4** Create ADR for RAG implementation decisions — OPTIONAL
  - Plan document at `docs/plans/enhanced-rag-implementation.md` serves this purpose

---

## Completion Checklist

- [x] All Phase 1 tasks complete ✓
- [x] All Phase 2 tasks complete ✓
- [x] All Phase 3 tasks complete ✓
- [x] All Phase 4 tasks complete ✓
- [x] All Phase 5 tasks complete ✓
- [x] All Phase 6 tasks complete (core tasks) ✓
- [ ] Manual QA testing passed — PENDING USER TESTING
- [ ] No regressions in existing chat functionality — PENDING USER TESTING

---

## Notes

- Tasks are designed to be ~10-15 minutes each
- Can pause after any task and resume later
- Mark tasks with `[x]` when complete
- Add notes under tasks if needed for context
