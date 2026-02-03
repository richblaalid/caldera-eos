-- =============================================
-- Migration: Create EOS Knowledge Chunks Table
-- Stores vectorized EOS methodology content for RAG
-- =============================================

-- =============================================
-- Table: eos_knowledge_chunks
-- Stores embedded chunks from EOS documentation (Traction book chapters)
-- =============================================

CREATE TABLE IF NOT EXISTS public.eos_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_file TEXT NOT NULL,           -- e.g., '03-the-vision-component.md'
  chapter_title TEXT,                  -- e.g., 'The Vision Component'
  section_heading TEXT,                -- e.g., 'Core Values'
  content TEXT NOT NULL,
  chunk_index INT DEFAULT 0,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}'::jsonb,  -- tags, related terms, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS eos_knowledge_chunks_embedding_hnsw_idx
  ON public.eos_knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS eos_knowledge_chunks_source_idx
  ON public.eos_knowledge_chunks(source_file);
CREATE INDEX IF NOT EXISTS eos_knowledge_chunks_chapter_idx
  ON public.eos_knowledge_chunks(chapter_title);

-- Enable RLS
ALTER TABLE public.eos_knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read knowledge chunks
CREATE POLICY "EOS knowledge viewable by authenticated users"
  ON public.eos_knowledge_chunks FOR SELECT TO authenticated USING (true);

-- Only allow service role to insert/update (for ingestion scripts)
CREATE POLICY "EOS knowledge editable by service role"
  ON public.eos_knowledge_chunks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================
-- Function: match_eos_knowledge
-- Performs semantic similarity search on EOS knowledge chunks
-- =============================================

CREATE OR REPLACE FUNCTION match_eos_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  source_file text,
  chapter_title text,
  section_heading text,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ek.id,
    ek.source_file,
    ek.chapter_title,
    ek.section_heading,
    ek.content,
    (1 - (ek.embedding <=> query_embedding))::float AS similarity
  FROM eos_knowledge_chunks ek
  WHERE ek.embedding IS NOT NULL
    AND (1 - (ek.embedding <=> query_embedding)) > match_threshold
  ORDER BY ek.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION match_eos_knowledge(vector(1536), float, int) TO authenticated;

-- =============================================
-- Trigger for updated_at
-- =============================================

CREATE TRIGGER update_eos_knowledge_chunks_updated_at
  BEFORE UPDATE ON public.eos_knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- Documentation
-- =============================================

COMMENT ON TABLE eos_knowledge_chunks IS 'Stores vectorized chunks from EOS methodology documentation (Traction book) for RAG-based coaching.';

COMMENT ON FUNCTION match_eos_knowledge IS 'Semantic similarity search on EOS knowledge chunks. Returns methodology content relevant to the query.';
