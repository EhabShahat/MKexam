-- Migration: 07_query_optimizations.sql
-- Description: Optimize API endpoint queries with selective field fetching and pagination
-- Date: 2026-01-30
-- Requirements: 5.7

-- ============================================================================
-- QUERY OPTIMIZATION GUIDE
-- ============================================================================
-- This file documents optimized query patterns for API endpoints.
-- These are code-level optimizations to be implemented in TypeScript/JavaScript.
-- No SQL migrations are needed, but this file serves as a reference.
-- ============================================================================

-- ============================================================================
-- 1. EXAM LIST QUERIES
-- ============================================================================

-- BAD: Fetches all columns and all rows
-- SELECT * FROM exams WHERE status = 'published' AND NOT is_archived;

-- GOOD: Selective fields with pagination
-- SELECT 
--   id, 
--   title, 
--   status, 
--   start_time, 
--   end_time, 
--   created_at,
--   exam_type,
--   access_type
-- FROM exams
-- WHERE status = 'published' AND NOT is_archived
-- ORDER BY created_at DESC
-- LIMIT 50 OFFSET 0;

-- TypeScript Implementation:
/*
const { data, error } = await supabaseClient
  .from('exams')
  .select('id, title, status, start_time, end_time, created_at, exam_type, access_type')
  .eq('status', 'published')
  .eq('is_archived', false)
  .order('created_at', { ascending: false })
  .range(0, 49); // First 50 items
*/

-- ============================================================================
-- 2. EXAM ATTEMPTS QUERIES
-- ============================================================================

-- BAD: Fetches all attempt data including large JSONB fields
-- SELECT * FROM exam_attempts WHERE exam_id = ?;

-- GOOD: Selective fields excluding large JSONB
-- SELECT 
--   id,
--   exam_id,
--   student_id,
--   student_name,
--   completion_status,
--   started_at,
--   submitted_at,
--   ip_address
-- FROM exam_attempts
-- WHERE exam_id = ?
-- ORDER BY started_at DESC
-- LIMIT 100;

-- TypeScript Implementation:
/*
const { data, error } = await supabaseClient
  .from('exam_attempts')
  .select('id, exam_id, student_id, student_name, completion_status, started_at, submitted_at, ip_address')
  .eq('exam_id', examId)
  .order('started_at', { ascending: false })
  .limit(100);
*/

-- ============================================================================
-- 3. RESULTS QUERIES WITH JOINS
-- ============================================================================

-- BAD: Multiple queries or unoptimized joins
-- SELECT * FROM exam_results;
-- Then fetch attempts separately

-- GOOD: Optimized join with selective fields
-- SELECT 
--   er.attempt_id,
--   er.score_percentage,
--   er.final_score_percentage,
--   er.total_questions,
--   er.correct_count,
--   ea.student_name,
--   ea.submitted_at,
--   ea.student_id
-- FROM exam_results er
-- INNER JOIN exam_attempts ea ON ea.id = er.attempt_id
-- WHERE ea.exam_id = ?
-- ORDER BY er.final_score_percentage DESC
-- LIMIT 100;

-- TypeScript Implementation:
/*
const { data, error } = await supabaseClient
  .from('exam_results')
  .select(`
    attempt_id,
    score_percentage,
    final_score_percentage,
    total_questions,
    correct_count,
    exam_attempts!inner(
      student_name,
      submitted_at,
      student_id,
      exam_id
    )
  `)
  .eq('exam_attempts.exam_id', examId)
  .order('final_score_percentage', { ascending: false })
  .limit(100);
*/

-- ============================================================================
-- 4. STUDENT QUERIES
-- ============================================================================

-- BAD: Fetches all students with all fields
-- SELECT * FROM students;

-- GOOD: Selective fields with search and pagination
-- SELECT 
--   id,
--   code,
--   student_name,
--   mobile_number,
--   created_at
-- FROM students
-- WHERE student_name ILIKE '%search%'
-- ORDER BY student_name
-- LIMIT 50 OFFSET 0;

-- TypeScript Implementation:
/*
const { data, error } = await supabaseClient
  .from('students')
  .select('id, code, student_name, mobile_number, created_at')
  .ilike('student_name', `%${searchTerm}%`)
  .order('student_name')
  .range(0, 49);
*/

-- ============================================================================
-- 5. AUDIT LOG QUERIES
-- ============================================================================

-- BAD: Fetches all audit logs
-- SELECT * FROM audit_logs ORDER BY created_at DESC;

-- GOOD: Paginated with selective fields
-- SELECT 
--   id,
--   actor,
--   action,
--   created_at,
--   meta->>'exam_id' as exam_id,
--   meta->>'exam_title' as exam_title
-- FROM audit_logs
-- ORDER BY created_at DESC
-- LIMIT 100 OFFSET 0;

-- TypeScript Implementation:
/*
const { data, error } = await supabaseClient
  .from('audit_logs')
  .select('id, actor, action, created_at, meta')
  .order('created_at', { ascending: false })
  .range(0, 99);
*/

-- ============================================================================
-- 6. MONITORING QUERIES
-- ============================================================================

-- BAD: Fetches all active attempts with full data
-- SELECT * FROM exam_attempts WHERE completion_status = 'in_progress';

-- GOOD: Scoped to exam with selective fields
-- SELECT 
--   id,
--   student_name,
--   started_at,
--   updated_at,
--   ip_address
-- FROM exam_attempts
-- WHERE exam_id = ?
--   AND completion_status = 'in_progress'
-- ORDER BY started_at DESC;

-- TypeScript Implementation:
/*
const { data, error } = await supabaseClient
  .from('exam_attempts')
  .select('id, student_name, started_at, updated_at, ip_address')
  .eq('exam_id', examId)
  .eq('completion_status', 'in_progress')
  .order('started_at', { ascending: false });
*/

-- ============================================================================
-- 7. AGGREGATION QUERIES
-- ============================================================================

-- BAD: Fetch all data and aggregate in JavaScript
-- SELECT * FROM exam_attempts WHERE exam_id = ?;
-- Then count in JS

-- GOOD: Use database aggregation
-- SELECT 
--   COUNT(*) as total_attempts,
--   COUNT(*) FILTER (WHERE completion_status = 'completed') as completed,
--   COUNT(*) FILTER (WHERE completion_status = 'in_progress') as in_progress,
--   AVG(EXTRACT(EPOCH FROM (submitted_at - started_at))/60) as avg_duration_minutes
-- FROM exam_attempts
-- WHERE exam_id = ?;

-- TypeScript Implementation:
/*
const { data, error } = await supabaseClient
  .rpc('get_exam_stats', { exam_id: examId });

-- Create RPC function:
CREATE OR REPLACE FUNCTION get_exam_stats(exam_id uuid)
RETURNS TABLE (
  total_attempts bigint,
  completed bigint,
  in_progress bigint,
  avg_duration_minutes numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_attempts,
    COUNT(*) FILTER (WHERE completion_status = 'completed') as completed,
    COUNT(*) FILTER (WHERE completion_status = 'in_progress') as in_progress,
    AVG(EXTRACT(EPOCH FROM (submitted_at - started_at))/60) as avg_duration_minutes
  FROM exam_attempts
  WHERE exam_attempts.exam_id = get_exam_stats.exam_id;
END;
$$ LANGUAGE plpgsql;
*/

-- ============================================================================
-- 8. CURSOR-BASED PAGINATION
-- ============================================================================

-- BAD: OFFSET-based pagination (slow for large offsets)
-- SELECT * FROM exam_attempts ORDER BY started_at DESC LIMIT 50 OFFSET 1000;

-- GOOD: Cursor-based pagination (fast for any page)
-- SELECT 
--   id,
--   student_name,
--   started_at
-- FROM exam_attempts
-- WHERE exam_id = ?
--   AND started_at < ? -- Cursor from previous page
-- ORDER BY started_at DESC
-- LIMIT 50;

-- TypeScript Implementation:
/*
const { data, error } = await supabaseClient
  .from('exam_attempts')
  .select('id, student_name, started_at')
  .eq('exam_id', examId)
  .lt('started_at', lastStartedAt) // Cursor
  .order('started_at', { ascending: false })
  .limit(50);
*/

-- ============================================================================
-- PERFORMANCE OPTIMIZATION FUNCTIONS
-- ============================================================================

-- Function: Get exam statistics efficiently
CREATE OR REPLACE FUNCTION get_exam_stats(p_exam_id uuid)
RETURNS TABLE (
  total_attempts bigint,
  completed bigint,
  in_progress bigint,
  abandoned bigint,
  avg_duration_minutes numeric,
  avg_score numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_attempts,
    COUNT(*) FILTER (WHERE ea.completion_status = 'completed') as completed,
    COUNT(*) FILTER (WHERE ea.completion_status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE ea.completion_status = 'abandoned') as abandoned,
    AVG(EXTRACT(EPOCH FROM (ea.submitted_at - ea.started_at))/60) 
      FILTER (WHERE ea.submitted_at IS NOT NULL) as avg_duration_minutes,
    AVG(er.final_score_percentage) as avg_score
  FROM exam_attempts ea
  LEFT JOIN exam_results er ON er.attempt_id = ea.id
  WHERE ea.exam_id = p_exam_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get student exam summary
CREATE OR REPLACE FUNCTION get_student_exam_summary(p_student_id uuid)
RETURNS TABLE (
  exam_id uuid,
  exam_title text,
  attempt_id uuid,
  score_percentage numeric,
  submitted_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id as exam_id,
    e.title as exam_title,
    ea.id as attempt_id,
    er.final_score_percentage as score_percentage,
    ea.submitted_at
  FROM exam_attempts ea
  INNER JOIN exams e ON e.id = ea.exam_id
  LEFT JOIN exam_results er ON er.attempt_id = ea.id
  WHERE ea.student_id = p_student_id
    AND ea.completion_status = 'completed'
  ORDER BY ea.submitted_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get leaderboard efficiently
CREATE OR REPLACE FUNCTION get_exam_leaderboard(p_exam_id uuid, p_limit int DEFAULT 100)
RETURNS TABLE (
  rank bigint,
  student_name text,
  score_percentage numeric,
  submitted_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROW_NUMBER() OVER (ORDER BY er.final_score_percentage DESC, ea.submitted_at ASC) as rank,
    ea.student_name,
    er.final_score_percentage as score_percentage,
    ea.submitted_at
  FROM exam_results er
  INNER JOIN exam_attempts ea ON ea.id = er.attempt_id
  WHERE ea.exam_id = p_exam_id
    AND ea.completion_status = 'completed'
  ORDER BY er.final_score_percentage DESC, ea.submitted_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify functions were created
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN ('get_exam_stats', 'get_student_exam_summary', 'get_exam_leaderboard')
  AND pronamespace = 'public'::regnamespace;

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. Always use selective field fetching (avoid SELECT *)
-- 2. Implement pagination for all list queries
-- 3. Use cursor-based pagination for large datasets
-- 4. Leverage database aggregation instead of client-side
-- 5. Create RPC functions for complex queries
-- 6. Use STABLE functions for read-only operations
-- 7. Add appropriate indexes for all query patterns
-- 8. Monitor query performance with EXPLAIN ANALYZE

-- Expected Impact:
-- - Query response time: 40-60% reduction
-- - Network payload: 50-70% reduction
-- - Memory usage: 40-60% reduction
-- - Database load: 30-50% reduction

-- Performance Targets:
-- - Simple queries: < 100ms
-- - Complex aggregations: < 300ms
-- - Paginated lists: < 200ms
-- - 95th percentile: < 500ms
