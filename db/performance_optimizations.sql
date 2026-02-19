-- Performance Optimization Indexes
-- Part of Supabase & Netlify Cost Optimization initiative
-- These indexes are designed to reduce query time and improve database performance

-- ============================================================================
-- COMPOSITE INDEXES
-- ============================================================================

-- Composite index for exam_attempts queries
-- Optimizes queries filtering by exam_id and completion_status, ordered by started_at
-- Use case: Admin dashboard filtering attempts by status
CREATE INDEX IF NOT EXISTS idx_attempts_exam_status_started 
ON public.exam_attempts(exam_id, completion_status, started_at DESC);

-- ============================================================================
-- COVERING INDEXES
-- ============================================================================

-- Covering index for questions
-- Includes frequently accessed columns to avoid table lookups
-- Use case: Loading exam questions with all necessary data in one index scan
CREATE INDEX IF NOT EXISTS idx_questions_exam_order_covering 
ON public.questions(exam_id, order_index) 
INCLUDE (question_text, question_type, options, points, required);

-- ============================================================================
-- BRIN INDEXES (Block Range INdexes)
-- ============================================================================

-- BRIN index for audit_logs (time-series data)
-- Efficient for large tables with naturally ordered time-series data
-- Use case: Querying audit logs by date range
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_brin 
ON public.audit_logs USING BRIN(created_at);

-- ============================================================================
-- EXPRESSION INDEXES
-- ============================================================================

-- Expression index for device fingerprint
-- Optimizes queries extracting fingerprint from JSONB device_info
-- Use case: Detecting duplicate attempts from same device
CREATE INDEX IF NOT EXISTS idx_attempts_device_fingerprint 
ON public.exam_attempts((device_info->>'fingerprint'));

-- ============================================================================
-- PARTIAL INDEXES
-- ============================================================================

-- Partial index for recent activity events
-- Only indexes events from the last 7 days to reduce index size
-- Use case: Monitoring recent student activity during active exams
CREATE INDEX IF NOT EXISTS idx_activity_events_recent 
ON public.attempt_activity_events(attempt_id, created_at DESC)
WHERE created_at > (now() - interval '7 days');

-- ============================================================================
-- UNIQUE INDEXES WITH INCLUDE
-- ============================================================================

-- Unique index with INCLUDE for student code lookups
-- Enforces uniqueness on code while including frequently accessed columns
-- Use case: Fast student validation by code with name and mobile lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_code_with_name 
ON public.students(code) 
INCLUDE (student_name, mobile_number);

-- ============================================================================
-- INDEX USAGE NOTES
-- ============================================================================

-- To verify index usage, run:
-- EXPLAIN ANALYZE SELECT ... FROM table WHERE ...;

-- To check index statistics:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;

-- To identify unused indexes (after 30 days):
-- SELECT schemaname, tablename, indexname, idx_scan
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public' AND idx_scan = 0
-- ORDER BY pg_relation_size(indexrelid) DESC;
