# Enhanced RAG System Implementation Plan

## Overview

Implement a semantic search and retrieval-augmented generation (RAG) system for Ember to provide contextually relevant coaching responses grounded in EOS methodology and Caldera's historical conversations.

## Current State Analysis

### What Exists
- **Database**: pgvector extension enabled, `transcript_chunks` table with `embedding VECTOR(1536)` column
- **Index**: IVFFLAT index on embeddings (basic, not optimized)
- **Chunking**: `transcripts.ts` has chunking logic (~1500 chars with 200 char overlap)
- **Context Retrieval**: `context.ts` uses PostgreSQL **text search** (websearch), not vector similarity
- **EOS Knowledge**: 10 chapter files in `.claude/skills/eos-domain-skill/chapters/` (not embedded)

### What's Missing
1. **Embedding Generation**: No function to generate embeddings from text
2. **Vector Search**: No semantic similarity search implementation
3. **EOS Knowledge Base**: Chapter content not vectorized for RAG
4. **Hybrid Search**: No combination of keyword + semantic search
5. **Reranking**: No relevance scoring or result reranking

## Technical Approach

### Embedding Model Selection

**Decision: OpenAI `text-embedding-3-small`**

| Option | Dimensions | Cost/1M tokens | Pros | Cons |
|--------|------------|----------------|------|------|
| OpenAI text-embedding-3-small | 1536 | $0.02 | Compatible with existing schema, good quality | Requires API call |
| OpenAI text-embedding-3-large | 3072 | $0.13 | Better quality | Schema change needed, higher cost |
| Voyage voyage-3.5 | 1024 | $0.06 | Domain-specific options | New dependency, schema change |

**Rationale**: Schema already uses VECTOR(1536). OpenAI's small model is cost-effective and sufficient for our transcript volume.

### Index Strategy

**Decision: Upgrade to HNSW index**

```sql
-- Drop existing IVFFLAT index
DROP INDEX IF EXISTS transcript_chunks_embedding_idx;

-- Create HNSW index (faster queries, no training needed)
CREATE INDEX transcript_chunks_embedding_hnsw_idx
  ON public.transcript_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

**Rationale**: HNSW provides better query performance and doesn't require index training like IVFFLAT.

### Search Strategy

**Decision: Hybrid Search with Reciprocal Rank Fusion (RRF)**

```
Final Score = (1 / (k + keyword_rank)) + (1 / (k + semantic_rank))
```

Where k=60 (standard RRF constant).

**Rationale**: Combines precision of keyword search (exact terms) with recall of semantic search (meaning-based). Critical for EOS terminology matching.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Chat Request                             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Query Understanding                           │
│  - Extract key concepts                                          │
│  - Classify intent (coaching, data lookup, facilitation)         │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│     Keyword Search        │   │    Semantic Search         │
│  - PostgreSQL full-text   │   │  - Generate query embed    │
│  - EOS term matching      │   │  - Vector similarity       │
└───────────────────────────┘   └───────────────────────────┘
                │                               │
                └───────────────┬───────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Reciprocal Rank Fusion                         │
│  - Combine results from both searches                            │
│  - Deduplicate and rerank                                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Context Assembly                              │
│  - EOS Knowledge (methodology explanations)                      │
│  - Transcript Context (historical conversations)                 │
│  - Current EOS Data (Rocks, Issues, Scorecard)                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Claude API Response                           │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model Changes

### New Table: EOS Knowledge Chunks

```sql
CREATE TABLE IF NOT EXISTS public.eos_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_file TEXT NOT NULL,           -- e.g., '03-the-vision-component.md'
  chapter_title TEXT,                  -- e.g., 'The Vision Component'
  section_heading TEXT,                -- e.g., 'Core Values'
  content TEXT NOT NULL,
  chunk_index INT,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}'::jsonb,  -- tags, related terms, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX eos_knowledge_chunks_embedding_hnsw_idx
  ON public.eos_knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### New PostgreSQL Functions

```sql
-- Semantic search for transcripts
CREATE OR REPLACE FUNCTION match_transcript_chunks(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  transcript_id UUID,
  content TEXT,
  speaker TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    tc.id,
    tc.transcript_id,
    tc.content,
    tc.speaker,
    1 - (tc.embedding <=> query_embedding) AS similarity
  FROM transcript_chunks tc
  WHERE tc.embedding IS NOT NULL
    AND 1 - (tc.embedding <=> query_embedding) > match_threshold
  ORDER BY tc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Semantic search for EOS knowledge
CREATE OR REPLACE FUNCTION match_eos_knowledge(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  source_file TEXT,
  chapter_title TEXT,
  section_heading TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    ek.id,
    ek.source_file,
    ek.chapter_title,
    ek.section_heading,
    ek.content,
    1 - (ek.embedding <=> query_embedding) AS similarity
  FROM eos_knowledge_chunks ek
  WHERE ek.embedding IS NOT NULL
    AND 1 - (ek.embedding <=> query_embedding) > match_threshold
  ORDER BY ek.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

## Implementation Phases

### Phase 1: Embedding Infrastructure (Foundation)

**Goal**: Establish the core embedding generation capability

1. **Add OpenAI dependency** for embeddings
2. **Create embedding service** (`lib/embeddings.ts`)
   - `generateEmbedding(text: string): Promise<number[]>`
   - `generateEmbeddings(texts: string[]): Promise<number[][]>` (batch)
   - Rate limiting and error handling
3. **Database migration** for HNSW index upgrade
4. **Create PostgreSQL functions** for similarity search

**Files affected**:
- `ember/package.json` (add openai dependency)
- `ember/src/lib/embeddings.ts` (new)
- `ember/supabase/migrations/XXX_add_rag_functions.sql` (new)

### Phase 2: EOS Knowledge Base (Domain RAG)

**Goal**: Vectorize EOS methodology for grounded coaching

1. **Create knowledge chunk table** and indexes
2. **Build ingestion script** to process chapter files
   - Parse markdown, extract sections
   - Chunk by heading/section
   - Generate embeddings
   - Store with metadata
3. **One-time ingestion** of 10 chapter files
4. **Semantic search function** for EOS knowledge

**Files affected**:
- `ember/supabase/migrations/XXX_create_eos_knowledge.sql` (new)
- `ember/scripts/ingest-eos-knowledge.ts` (new)
- `ember/src/lib/eos-knowledge.ts` (new)

### Phase 3: Transcript Embedding Pipeline

**Goal**: Enable semantic search over historical conversations

1. **Update transcript processing** to generate embeddings
   - Modify `processTranscript` to call embedding service
   - Store embeddings in `transcript_chunks.embedding`
2. **Backfill script** for existing chunks without embeddings
3. **Semantic search function** for transcripts

**Files affected**:
- `ember/src/lib/transcripts.ts` (modify)
- `ember/scripts/backfill-embeddings.ts` (new)
- `ember/src/app/api/transcripts/process/route.ts` (modify)

### Phase 4: Hybrid Search Implementation

**Goal**: Combine keyword and semantic search for best results

1. **Hybrid search service** (`lib/hybrid-search.ts`)
   - Parallel keyword + semantic queries
   - RRF fusion algorithm
   - Deduplication
2. **Update context retrieval** to use hybrid search
3. **Add search type parameter** (keyword, semantic, hybrid)

**Files affected**:
- `ember/src/lib/hybrid-search.ts` (new)
- `ember/src/lib/context.ts` (modify)

### Phase 5: Enhanced Context Assembly

**Goal**: Smarter context building for chat

1. **Intent classification** for queries
   - EOS methodology question → prioritize knowledge base
   - Historical data question → prioritize transcripts
   - Current state question → prioritize live EOS data
2. **Context budget management**
   - Allocate tokens across sources
   - Prioritize by relevance scores
3. **Source attribution** in responses

**Files affected**:
- `ember/src/lib/context.ts` (major refactor)
- `ember/src/app/api/chat/route.ts` (modify)

## Environment Variables

```env
# OpenAI (for embeddings)
OPENAI_API_KEY=sk-...

# Optional: Embedding model override
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

## Testing Strategy

### Unit Tests
- Embedding generation (mock API)
- Chunking with overlap
- RRF fusion algorithm
- Similarity threshold filtering

### Integration Tests
- End-to-end transcript processing with embeddings
- Semantic search returning relevant results
- Hybrid search combining both methods

### Quality Metrics
- **Recall@K**: Relevant documents in top K results
- **MRR**: Mean reciprocal rank of first relevant result
- **Latency**: P50/P95 search response times

## Cost Estimation

| Item | Volume | Cost |
|------|--------|------|
| EOS Knowledge embedding (one-time) | ~50K tokens | $0.001 |
| Transcript embedding per meeting | ~10K tokens | $0.0002 |
| Query embedding per chat | ~100 tokens | $0.000002 |
| Monthly estimate (50 chats/day) | ~150K tokens | $0.003 |

**Total estimated monthly cost**: < $1

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenAI API latency adds to response time | Medium | Cache embeddings, batch where possible |
| Embedding quality degrades retrieval | High | Test with real queries, tune thresholds |
| Storage costs increase with vectors | Low | 1536 floats × chunks = minimal |
| EOS knowledge becomes stale | Low | Re-ingest when skill files update |

## Success Criteria

1. **Functional**: Ember can answer "What does EOS say about Core Values?" with grounded response citing source
2. **Relevant**: Queries about past discussions return semantically related transcript chunks
3. **Fast**: Search latency < 500ms P95
4. **Accurate**: Human evaluation shows improved answer quality vs. text search baseline

## Dependencies

- OpenAI API access (for embeddings)
- Existing Supabase infrastructure
- EOS domain skill files (`.claude/skills/eos-domain-skill/chapters/`)

## Timeline Estimate

| Phase | Scope | Estimate |
|-------|-------|----------|
| Phase 1 | Embedding Infrastructure | 2-3 hours |
| Phase 2 | EOS Knowledge Base | 2-3 hours |
| Phase 3 | Transcript Embedding | 2-3 hours |
| Phase 4 | Hybrid Search | 2-3 hours |
| Phase 5 | Enhanced Context | 3-4 hours |
| **Total** | | **11-16 hours** |

## References

- [Supabase Vector Search Guide](https://supabase.com/docs/guides/ai/vector-search)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
- [Reciprocal Rank Fusion Paper](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)
