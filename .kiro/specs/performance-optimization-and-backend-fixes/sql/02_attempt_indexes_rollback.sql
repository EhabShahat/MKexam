-- Rollback: 02_attempt_indexes.sql
-- Description: Remove attempt table indexes and restore duplicate
-- Date: 2026-01-30

-- Drop indexes created in 02_attempt_indexes.sql
DROP INDEX IF EXISTS idx_attempts_exam_student_name;
DROP INDEX IF EXISTS idx_attempts_exam_status;

-- Restore the duplicate index (if rollback is needed)
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_id 
ON exam_attempts(student_id);

-- Verify rollback
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'exam_attempts'
  AND schemaname = 'public'
ORDER BY indexname;
