-- Rollback: 04_student_indexes.sql
-- Description: Remove student table indexes
-- Date: 2026-01-30

-- Drop student indexes
DROP INDEX IF EXISTS idx_students_name_trgm;
DROP INDEX IF EXISTS idx_students_name;
DROP INDEX IF EXISTS idx_students_national_id;

-- Note: We don't drop idx_students_code and idx_students_mobile as they existed before
-- Note: We don't drop pg_trgm extension as it may be used by other features

-- Verify rollback
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'students'
  AND schemaname = 'public'
ORDER BY indexname;
