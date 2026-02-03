-- =============================================
-- Clear All EOS Test Data
-- Run this in Supabase SQL Editor to reset the database
-- WARNING: This deletes ALL data - use with caution!
-- =============================================

-- Clear in order respecting foreign keys

-- Chat messages (private conversations)
DELETE FROM public.chat_messages;

-- Insights
DELETE FROM public.insights;

-- Transcript chunks (before transcripts due to FK)
DELETE FROM public.transcript_chunks;

-- Transcripts
DELETE FROM public.transcripts;

-- Meetings
DELETE FROM public.meetings;

-- Scorecard entries (before metrics due to FK)
DELETE FROM public.scorecard_entries;

-- Scorecard metrics
DELETE FROM public.scorecard_metrics;

-- Todos
DELETE FROM public.todos;

-- Issues
DELETE FROM public.issues;

-- Rocks
DELETE FROM public.rocks;

-- VTO (Vision/Traction Organizer)
DELETE FROM public.vto;

-- Optionally reset organization memberships (uncomment if needed)
-- DELETE FROM public.organization_members;

-- Verify cleanup
SELECT 'vto' as table_name, COUNT(*) as count FROM public.vto
UNION ALL SELECT 'rocks', COUNT(*) FROM public.rocks
UNION ALL SELECT 'issues', COUNT(*) FROM public.issues
UNION ALL SELECT 'todos', COUNT(*) FROM public.todos
UNION ALL SELECT 'scorecard_metrics', COUNT(*) FROM public.scorecard_metrics
UNION ALL SELECT 'scorecard_entries', COUNT(*) FROM public.scorecard_entries
UNION ALL SELECT 'meetings', COUNT(*) FROM public.meetings
UNION ALL SELECT 'transcripts', COUNT(*) FROM public.transcripts
UNION ALL SELECT 'transcript_chunks', COUNT(*) FROM public.transcript_chunks
UNION ALL SELECT 'insights', COUNT(*) FROM public.insights
UNION ALL SELECT 'chat_messages', COUNT(*) FROM public.chat_messages;
