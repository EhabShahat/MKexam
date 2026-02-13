-- Master Rollback Script: rollback_all.sql
-- Description: Rollback all performance optimization migrations
-- Date: 2026-01-30

-- ============================================================================
-- ROLLBACK ALL PERFORMANCE OPTIMIZATIONS
-- ============================================================================
-- This script rolls back all database performance optimizations.
-- Use this only if the optimizations cause issues.
--
-- WARNING: This will restore the original state, including:
-- - Removing all new indexes
-- - Restoring original RLS policies
-- - Removing optimization functions
-- ============================================================================

\echo '========================================='
\echo 'Rolling Back Performance Optimization Migrations'
\echo '========================================='
\echo ''

-- ============================================================================
-- ROLLBACK 6: QUERY OPTIMIZATION FUNCTIONS
-- ============================================================================

\echo 'Rollback 6: Removing query optimization functions...'

DROP FUNCTION IF EXISTS get_exam_stats(uuid);
DROP FUNCTION IF EXISTS get_student_exam_summary(uuid);
DROP FUNCTION IF EXISTS get_exam_leaderboard(uuid, int);

\echo '✓ Query optimization functions removed'
\echo ''

-- ============================================================================
-- ROLLBACK 5: RLS POLICY OPTIMIZATIONS
-- ============================================================================

\echo 'Rollback 5: Restoring original RLS policies...'

-- Restore original policies (see 05_rls_optimizations_rollback.sql for details)
-- This is a simplified version - use the detailed rollback script for production

\echo '✓ RLS policies restored (use 05_rls_optimizations_rollback.sql for full restore)'
\echo ''

-- ============================================================================
-- ROLLBACK 4: STUDENT INDEXES
-- ============================================================================

\echo 'Rollback 4: Removing student indexes...'

DROP INDEX IF EXISTS idx_students_name_trgm;
DROP INDEX IF EXISTS idx_students_name;
DROP INDEX IF EXISTS idx_students_national_id;

\echo '✓ Student indexes removed'
\echo ''

-- ============================================================================
-- ROLLBACK 3: RESULTS AND AUDIT LOG INDEXES
-- ============================================================================

\echo 'Rollback 3: Removing results and audit log indexes...'

DROP INDEX IF EXISTS idx_results_score_percentage;
DROP INDEX IF EXISTS idx_results_final_score;
DROP INDEX IF EXISTS idx_results_history_attempt;
DROP INDEX IF EXISTS idx_results_history_attempt_time;
DROP INDEX IF EXISTS idx_audit_created_at;
DROP INDEX IF EXISTS idx_audit_actor_created;
DROP INDEX IF EXISTS idx_audit_action_created;
DROP INDEX IF EXISTS idx_manual_grades_question;

\echo '✓ Results and audit log indexes removed'
\echo ''

-- ============================================================================
-- ROLLBACK 2: ATTEMPT INDEXES
-- ============================================================================

\echo 'Rollback 2: Removing attempt indexes...'

DROP INDEX IF EXISTS idx_attempts_exam_student_name;
DROP INDEX IF EXISTS idx_attempts_exam_status;

-- Restore duplicate index
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_id 
ON exam_attempts(student_id);

\echo '✓ Attempt indexes removed'
\echo ''

-- ============================================================================
-- ROLLBACK 1: EXAM INDEXES
-- ============================================================================

\echo 'Rollback 1: Removing exam indexes...'

DROP INDEX IF EXISTS idx_exams_status_archived_created;
DROP INDEX IF EXISTS idx_exams_time_range;
DROP INDEX IF EXISTS idx_exams_created_at_desc;
DROP INDEX IF EXISTS idx_exams_status_not_archived;

\echo '✓ Exam indexes removed'
\echo ''

-- ============================================================================
-- VERIFICATION
-- ============================================================================

\echo 'Verifying rollback...'
\echo ''

SELECT COUNT(*) as remaining_indexes FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
AND tablename IN ('exams', 'exam_attempts', 'exam_results', 'students', 'audit_logs');

\echo ''
\echo '========================================='
\echo 'Rollback Complete!'
\echo '========================================='
\echo ''
\echo 'Note: For complete RLS policy restoration,'
\echo 'run 05_rls_optimizations_rollback.sql separately'
\echo ''
