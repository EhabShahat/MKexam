-- Migration: 02_attempt_indexes.sql
-- Description: Create optimized indexes for exam attempt queries
-- Date: 2026-01-30
-- Requirements: 5.2

-- ============================================================================
-- EXAM_ATTEMPTS TABLE INDEXES
-- ============================================================================

-- Index 1: Composite index for student lookup by exam
-- Covers queries that find a student's attempt for a specific exam
-- Query pattern: SELECT * FROM exam_attempts WHERE exam_id = ? AND student_name = ?
CREATE INDEX IF NOT EXISTS idx_attempts_exam_student_name 
ON exam_attempts(exam_id, student_name);

-- Index 2: Index for submitted attempts ordered by submission time
-- Covers queries that list submitted attempts chronologically
-- Query pattern: SELECT * FROM exam_attempts WHERE submitted_at IS NOT NULL ORDER BY submitted_at DESC
-- Note: This index already exists as idx_attempts_submitted_at, but we ensure it's present
-- CREATE INDEX IF NOT EXISTS idx_attempts_submitted_at ON exam_attempts(submitted_at DESC);

-- Index 3: Composite index for monitoring active attempts
-- Covers queries that monitor in-progress attempts for an exam
-- Query pattern: SELECT * FROM exam_attempts WHERE exam_id = ? AND completion_status = 'in_progress'
CREATE INDEX IF NOT EXISTS idx_attempts_exam_status 
ON exam_attempts(exam_id, completion_status);

-- Index 4: Remove duplicate index
-- The audit identified idx_exam_attempts_student_id as a duplicate of idx_attempts_student_id
-- We keep idx_attempts_student_id and drop the duplicate
DROP INDEX IF EXISTS idx_exam_attempts_student_id;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify new indexes were created
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'exam_attempts'
  AND schemaname = 'public'
  AND indexname IN ('idx_attempts_exam_student_name', 'idx_attempts_exam_status', 'idx_attempts_submitted_at')
ORDER BY indexname;

-- Verify duplicate index was removed
SELECT 
    indexname
FROM pg_indexes
WHERE tablename = 'exam_attempts'
  AND schemaname = 'public'
  AND indexname = 'idx_exam_attempts_student_id';
-- Should return 0 rows

-- Check all exam_attempts indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'exam_attempts'
  AND schemaname = 'public'
ORDER BY indexname;

-- ============================================================================
-- PERFORMANCE TESTING
-- ============================================================================

-- Test Query 1: Find student's attempt (should use idx_attempts_exam_student_name)
-- EXPLAIN ANALYZE
-- SELECT id, student_name, completion_status, started_at, submitted_at
-- FROM exam_attempts
-- WHERE exam_id = 'some-exam-id'
--   AND student_name = 'John Doe';

-- Test Query 2: Monitor active attempts (should use idx_attempts_exam_status)
-- EXPLAIN ANALYZE
-- SELECT id, student_name, started_at, updated_at
-- FROM exam_attempts
-- WHERE exam_id = 'some-exam-id'
--   AND completion_status = 'in_progress'
-- ORDER BY started_at DESC;

-- Test Query 3: Recent submissions (should use idx_attempts_submitted_at)
-- EXPLAIN ANALYZE
-- SELECT id, exam_id, student_name, submitted_at
-- FROM exam_attempts
-- WHERE submitted_at IS NOT NULL
-- ORDER BY submitted_at DESC
-- LIMIT 50;

-- Test Query 4: Student's all attempts (should use idx_attempts_student_id)
-- EXPLAIN ANALYZE
-- SELECT id, exam_id, completion_status, started_at
-- FROM exam_attempts
-- WHERE student_id = 'some-student-id'
-- ORDER BY started_at DESC;

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. All indexes use IF NOT EXISTS to be idempotent
-- 2. Removed duplicate index to reduce write overhead and storage
-- 3. Composite indexes are ordered by selectivity (most selective first)
-- 4. These indexes should reduce attempt query response times by 40-60%

-- Expected Impact:
-- - Student lookup queries: 50-100ms → 10-20ms
-- - Monitoring queries: 100-200ms → 20-40ms
-- - Submission list queries: 50-100ms → 10-20ms
-- - Reduced write overhead from duplicate index removal

-- Index Size Savings:
-- - Removing idx_exam_attempts_student_id saves ~2-5MB depending on data volume
