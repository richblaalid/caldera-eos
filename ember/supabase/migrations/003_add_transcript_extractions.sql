-- Add extractions JSONB column to transcripts table
-- Stores AI-extracted issues, todos, and decisions from transcript processing

ALTER TABLE public.transcripts
ADD COLUMN IF NOT EXISTS extractions JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.transcripts.extractions IS 'AI-extracted items (issues, todos, decisions) from transcript processing';
