-- =============================================
-- Migration: Add RAG (Retrieval-Augmented Generation) Functions
-- Upgrades index from IVFFLAT to HNSW and adds similarity search functions
-- =============================================

-- Drop existing IVFFLAT index on transcript_chunks (if exists)
DROP INDEX IF EXISTS transcript_chunks_embedding_idx;

-- Create HNSW index for faster similarity search
-- HNSW provides better query performance and doesn't require index training
CREATE INDEX IF NOT EXISTS transcript_chunks_embedding_hnsw_idx
  ON public.transcript_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- =============================================
-- Function: match_transcript_chunks
-- Performs semantic similarity search on transcript chunks
-- =============================================

CREATE OR REPLACE FUNCTION match_transcript_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  transcript_id uuid,
  content text,
  speaker text,
  chunk_index int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tc.id,
    tc.transcript_id,
    tc.content,
    tc.speaker,
    tc.chunk_index,
    (1 - (tc.embedding <=> query_embedding))::float AS similarity
  FROM transcript_chunks tc
  WHERE tc.embedding IS NOT NULL
    AND (1 - (tc.embedding <=> query_embedding)) > match_threshold
  ORDER BY tc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION match_transcript_chunks(vector(1536), float, int) TO authenticated;

-- =============================================
-- Function: match_transcript_chunks_with_transcript
-- Returns chunks with transcript metadata joined
-- =============================================

CREATE OR REPLACE FUNCTION match_transcript_chunks_with_transcript(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  chunk_id uuid,
  transcript_id uuid,
  transcript_title text,
  meeting_date timestamptz,
  content text,
  speaker text,
  chunk_index int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tc.id AS chunk_id,
    tc.transcript_id,
    t.title AS transcript_title,
    t.meeting_date,
    tc.content,
    tc.speaker,
    tc.chunk_index,
    (1 - (tc.embedding <=> query_embedding))::float AS similarity
  FROM transcript_chunks tc
  JOIN transcripts t ON t.id = tc.transcript_id
  WHERE tc.embedding IS NOT NULL
    AND (1 - (tc.embedding <=> query_embedding)) > match_threshold
  ORDER BY tc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION match_transcript_chunks_with_transcript(vector(1536), float, int) TO authenticated;

-- =============================================
-- Add comment for documentation
-- =============================================

COMMENT ON FUNCTION match_transcript_chunks IS 'Semantic similarity search on transcript chunks using cosine distance. Returns chunks with similarity score above threshold.';

COMMENT ON FUNCTION match_transcript_chunks_with_transcript IS 'Semantic similarity search with transcript metadata joined. Returns chunks with transcript title and meeting date.';
