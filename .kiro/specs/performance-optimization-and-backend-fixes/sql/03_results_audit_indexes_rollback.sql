-- Rollback: 03_results_audit_indexes.sql
-- Description: Remove results and audit log indexes
-- Date: 2026-01-30

-- Drop exam_results indexes
DROP INDEX IF EXISTS idx_results_score_percentage;
DROP INDEX IF EXISTS idx_results_final_score;

-- Drop exam_results_history indexes
DROP INDEX IF EXISTS idx_results_history_attempt;
DROP INDEX IF EXISTS idx_results_history_attempt_time;

-- Drop audit_logs indexes
DROP INDEX IF EXISTS idx_audit_created_at;
DROP INDEX IF EXISTS idx_audit_actor_created;
DROP INDEX IF EXISTS idx_audit_action_created;

-- Drop manual_grades indexes
DROP INDEX IF EXISTS idx_manual_grades_question;

-- Verify rollback
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('exam_results', 'exam_results_history', 'audit_logs', 'manual_grades')
ORDER BY tablename, indexname;
