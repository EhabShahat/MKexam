-- Rollback: 01_exam_indexes.sql
-- Description: Remove exam table indexes
-- Date: 2026-01-30

-- Drop indexes created in 01_exam_indexes.sql
DROP INDEX IF EXISTS idx_exams_status_archived_created;
DROP INDEX IF EXISTS idx_exams_time_range;
DROP INDEX IF EXISTS idx_exams_created_at_desc;
DROP INDEX IF EXISTS idx_exams_status_not_archived;

-- Verify indexes were removed
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'exams'
  AND schemaname = 'public'
  AND indexname LIKE 'idx_exams_%'
ORDER BY indexname;
