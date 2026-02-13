-- Performance Optimizations for Score Calculation System
-- Additional indexes and query optimizations beyond the base score_calculation_views.sql
-- Safe and idempotent

-- ============================================================================
-- ADDITIONAL PERFORMANCE INDEXES
-- ============================================================================

-- Composite index for exam attempts with completion status filtering
-- Optimizes queries that filter by student and completion status
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_completion 
  ON public.exam_attempts(student_id, completion_status) 
  WHERE completion_status = 'submitted';

-- Partial index for active exams only
-- Optimizes queries that only look at published/active exams
CREATE INDEX IF NOT EXISTS idx_exams_active 
  ON public.exams(id, title, exam_type, settings) 
  WHERE status IN ('published', 'done');

-- Index for exam results with score filtering
-- Optimizes queries that filter by score ranges
CREATE INDEX IF NOT EXISTS idx_exam_results_scores 
  ON public.exam_results(attempt_id, score_percentage, final_score_percentage)
  WHERE score_percentage IS NOT NULL OR final_score_percentage IS NOT NULL;

-- Composite index for extra scores with data filtering
-- Optimizes queries that check for non-empty extra score data
CREATE INDEX IF NOT EXISTS idx_extra_scores_student_data 
  ON public.extra_scores(student_id, updated_at) 
  WHERE data IS NOT NULL AND data != '{}'::jsonb;

-- Index for attendance records by student and date
-- Optimizes attendance percentage calculations
CREATE INDEX IF NOT EXISTS idx_attendance_student_date 
  ON public.attendance_records(student_id, session_date);

-- Partial index for recent exam attempts
-- Optimizes queries for recent activity
CREATE INDEX IF NOT EXISTS idx_exam_attempts_recent 
  ON public.exam_attempts(student_id, submitted_at DESC) 
  WHERE submitted_at > (NOW() - INTERVAL '30 days');

-- ============================================================================
-- QUERY OPTIMIZATION VIEWS
-- ============================================================================

-- View for quick student statistics without full materialized view
CREATE OR REPLACE VIEW public.student_stats_summary AS
SELECT 
  s.id as student_id,
  s.code as student_code,
  s.student_name,
  COUNT(DISTINCT ea.exam_id) FILTER (WHERE ea.completion_status = 'submitted' AND e.status = 'done') as completed_exams,
  MAX(ea.submitted_at) as last_submission,
  CASE WHEN es.data IS NOT NULL THEN true ELSE false END as has_extra_scores
FROM public.students s
LEFT JOIN public.exam_attempts ea ON ea.student_id = s.id
LEFT JOIN public.exams e ON e.id = ea.exam_id
LEFT JOIN public.extra_scores es ON es.student_id = s.id
GROUP BY s.id, s.code, s.student_name, es.data;

-- Index on the view for fast lookups
CREATE INDEX IF NOT EXISTS idx_student_stats_code 
  ON public.students(code);

-- ============================================================================
-- OPTIMIZED FUNCTIONS FOR BATCH OPERATIONS
-- ============================================================================

-- Function to get student codes in batches with pagination
CREATE OR REPLACE FUNCTION public.get_student_codes_batch(
  batch_size integer DEFAULT 200,
  offset_value integer DEFAULT 0
)
RETURNS TABLE(student_code text, student_id uuid) AS $
BEGIN
  RETURN QUERY
  SELECT s.code, s.id
  FROM public.students s
  ORDER BY s.code
  LIMIT batch_size
  OFFSET offset_value;
END;
$ LANGUAGE plpgsql;

-- Function to get exam configuration for score calculation
CREATE OR REPLACE FUNCTION public.get_exam_config_for_calculation()
RETURNS TABLE(
  exam_id uuid,
  exam_title text,
  exam_type text,
  pass_threshold numeric,
  include_in_pass boolean
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.title,
    e.exam_type,
    (e.settings->>'pass_percentage')::numeric,
    COALESCE(epc.include_in_pass, true)
  FROM public.exams e
  LEFT JOIN public.exam_public_config epc ON epc.exam_id = e.id
  WHERE e.status = 'done'
  ORDER BY e.created_at;
END;
$ LANGUAGE plpgsql;

-- Function to get bulk student data for score calculation
-- Optimized version that fetches all required data in minimal queries
CREATE OR REPLACE FUNCTION public.get_bulk_student_data(
  student_codes text[]
)
RETURNS TABLE(
  student_id uuid,
  student_code text,
  student_name text,
  exam_attempts jsonb,
  extra_scores jsonb,
  last_attempt_date timestamptz,
  exams_taken bigint
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    sss.student_id,
    sss.student_code,
    sss.student_name,
    sss.exam_attempts,
    sss.extra_scores,
    sss.last_attempt_date,
    sss.exams_taken
  FROM public.student_score_summary sss
  WHERE sss.student_code = ANY(student_codes)
  ORDER BY sss.student_code;
END;
$ LANGUAGE plpgsql;

-- ============================================================================
-- CACHE OPTIMIZATION FUNCTIONS
-- ============================================================================

-- Function to batch insert cache entries
CREATE OR REPLACE FUNCTION public.batch_insert_cache_entries(
  entries jsonb
)
RETURNS integer AS $
DECLARE
  inserted_count integer;
BEGIN
  INSERT INTO public.score_calculation_cache (
    student_code,
    calculation_result,
    settings_hash,
    calculated_at,
    expires_at
  )
  SELECT 
    (entry->>'student_code')::text,
    (entry->'calculation_result')::jsonb,
    (entry->>'settings_hash')::text,
    COALESCE((entry->>'calculated_at')::timestamptz, NOW()),
    COALESCE((entry->>'expires_at')::timestamptz, NOW() + INTERVAL '5 minutes')
  FROM jsonb_array_elements(entries) AS entry
  ON CONFLICT (student_code) DO UPDATE SET
    calculation_result = EXCLUDED.calculation_result,
    settings_hash = EXCLUDED.settings_hash,
    calculated_at = EXCLUDED.calculated_at,
    expires_at = EXCLUDED.expires_at;
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$ LANGUAGE plpgsql;

-- Function to get cache entries by settings hash
CREATE OR REPLACE FUNCTION public.get_cache_by_settings(
  settings_hash_param text,
  student_codes text[] DEFAULT NULL
)
RETURNS TABLE(
  student_code text,
  calculation_result jsonb,
  calculated_at timestamptz,
  expires_at timestamptz
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    scc.student_code,
    scc.calculation_result,
    scc.calculated_at,
    scc.expires_at
  FROM public.score_calculation_cache scc
  WHERE scc.settings_hash = settings_hash_param
    AND scc.expires_at > NOW()
    AND (student_codes IS NULL OR scc.student_code = ANY(student_codes))
  ORDER BY scc.student_code;
END;
$ LANGUAGE plpgsql;

-- ============================================================================
-- QUERY PERFORMANCE MONITORING
-- ============================================================================

-- Function to analyze query performance
CREATE OR REPLACE FUNCTION public.analyze_query_performance()
RETURNS TABLE(
  table_name text,
  total_scans bigint,
  seq_scans bigint,
  index_scans bigint,
  index_usage_ratio numeric,
  tuples_read bigint,
  tuples_fetched bigint,
  recommendation text
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    stat.relname::text,
    stat.seq_scan + stat.idx_scan as total_scans,
    stat.seq_scan,
    stat.idx_scan,
    CASE 
      WHEN (stat.seq_scan + stat.idx_scan) > 0 
      THEN ROUND((stat.idx_scan::numeric / (stat.seq_scan + stat.idx_scan)) * 100, 2)
      ELSE 0
    END as index_usage_ratio,
    stat.seq_tup_read + stat.idx_tup_fetch as tuples_read,
    stat.idx_tup_fetch,
    CASE 
      WHEN stat.seq_scan > stat.idx_scan AND stat.seq_scan > 100 
      THEN 'Consider adding indexes - high sequential scan ratio'
      WHEN stat.idx_scan = 0 AND stat.seq_scan > 0 
      THEN 'No index usage detected - review query patterns'
      WHEN (stat.seq_scan + stat.idx_scan) = 0 
      THEN 'Table not accessed recently'
      ELSE 'Good index usage'
    END as recommendation
  FROM pg_stat_user_tables stat
  WHERE stat.schemaname = 'public'
    AND stat.relname IN ('students', 'exam_attempts', 'exam_results', 'extra_scores', 'student_score_summary', 'score_calculation_cache')
  ORDER BY (stat.seq_scan + stat.idx_scan) DESC;
END;
$ LANGUAGE plpgsql;

-- ============================================================================
-- MAINTENANCE FUNCTIONS
-- ============================================================================

-- Function to update table statistics
CREATE OR REPLACE FUNCTION public.update_score_calculation_stats()
RETURNS text AS $
BEGIN
  -- Analyze key tables to update statistics
  ANALYZE public.students;
  ANALYZE public.exam_attempts;
  ANALYZE public.exam_results;
  ANALYZE public.extra_scores;
  ANALYZE public.student_score_summary;
  ANALYZE public.score_calculation_cache;
  
  RETURN 'Statistics updated for all score calculation tables';
END;
$ LANGUAGE plpgsql;

-- Function to reindex score calculation tables
CREATE OR REPLACE FUNCTION public.reindex_score_calculation_tables()
RETURNS text AS $
BEGIN
  -- Reindex key tables (use CONCURRENTLY in production)
  REINDEX TABLE public.students;
  REINDEX TABLE public.exam_attempts;
  REINDEX TABLE public.exam_results;
  REINDEX TABLE public.extra_scores;
  REINDEX TABLE public.score_calculation_cache;
  
  -- Refresh materialized view
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.student_score_summary;
  
  RETURN 'Reindexing completed for all score calculation tables';
END;
$ LANGUAGE plpgsql;

-- ============================================================================
-- PERFORMANCE MONITORING VIEWS
-- ============================================================================

-- View for monitoring slow queries
CREATE OR REPLACE VIEW public.slow_query_monitor AS
SELECT 
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  CASE 
    WHEN (seq_scan + idx_scan) > 0 
    THEN ROUND((idx_scan::numeric / (seq_scan + idx_scan)) * 100, 2)
    ELSE 0
  END as index_usage_percent,
  n_tup_ins + n_tup_upd + n_tup_del as total_modifications
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND (seq_scan + idx_scan) > 0
ORDER BY seq_scan DESC, (seq_scan + idx_scan) DESC;

-- View for cache effectiveness monitoring
CREATE OR REPLACE VIEW public.cache_effectiveness AS
SELECT 
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE expires_at > NOW()) as active_entries,
  COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_entries,
  ROUND(AVG(EXTRACT(EPOCH FROM (expires_at - calculated_at)))) as avg_ttl_seconds,
  MIN(calculated_at) as oldest_entry,
  MAX(calculated_at) as newest_entry,
  pg_size_pretty(pg_total_relation_size('public.score_calculation_cache')) as cache_size
FROM public.score_calculation_cache;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.get_bulk_student_data(text[]) IS 
  'Optimized function to fetch student data in bulk for score calculation';

COMMENT ON FUNCTION public.batch_insert_cache_entries(jsonb) IS 
  'Efficiently insert multiple cache entries in a single operation';

COMMENT ON FUNCTION public.analyze_query_performance() IS 
  'Analyze query performance and provide optimization recommendations';

COMMENT ON VIEW public.slow_query_monitor IS 
  'Monitor tables with high sequential scan ratios for optimization opportunities';

COMMENT ON VIEW public.cache_effectiveness IS 
  'Monitor cache hit rates and effectiveness metrics';

-- ============================================================================
-- AUTOMATIC MAINTENANCE JOBS (Optional - requires pg_cron extension)
-- ============================================================================

-- Note: These would require the pg_cron extension to be enabled
-- Uncomment and modify as needed for automatic maintenance

/*
-- Clean up expired cache entries every 5 minutes
SELECT cron.schedule('cleanup-score-cache', '*/5 * * * *', 'SELECT public.cleanup_expired_score_cache();');

-- Update statistics daily at 2 AM
SELECT cron.schedule('update-score-stats', '0 2 * * *', 'SELECT public.update_score_calculation_stats();');

-- Refresh materialized view every hour
SELECT cron.schedule('refresh-score-summary', '0 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY public.student_score_summary;');
*/