-- Results Summary Materialized View
-- Pre-aggregates student scores across all exams for fast All Exams view loading
-- Refresh this view periodically or on-demand

-- Drop existing view if it exists
DROP MATERIALIZED VIEW IF EXISTS results_summary_mv CASCADE;

-- Create materialized view with aggregated student scores
CREATE MATERIALIZED VIEW results_summary_mv AS
SELECT 
  s.id as student_id,
  s.student_name,
  s.code,
  e.id as exam_id,
  e.title as exam_title,
  e.exam_type,
  -- Get best score for each student-exam combination
  MAX(
    COALESCE(er.final_score_percentage, er.score_percentage)
  ) as best_score,
  -- Count attempts
  COUNT(sea.id) as attempt_count,
  -- Latest attempt timestamp
  MAX(ea.submitted_at) as last_attempt_at,
  -- Completion status of best attempt
  (
    SELECT ea2.completion_status 
    FROM student_exam_attempts sea2 
    JOIN exam_attempts ea2 ON sea2.attempt_id = ea2.id
    LEFT JOIN exam_results er2 ON ea2.id = er2.attempt_id
    WHERE sea2.student_id = s.id 
      AND sea2.exam_id = e.id
      AND COALESCE(er2.final_score_percentage, er2.score_percentage) = 
          MAX(COALESCE(er.final_score_percentage, er.score_percentage))
    LIMIT 1
  ) as completion_status
FROM students s
CROSS JOIN exams e
LEFT JOIN student_exam_attempts sea 
  ON sea.student_id = s.id 
  AND sea.exam_id = e.id
LEFT JOIN exam_attempts ea
  ON sea.attempt_id = ea.id
LEFT JOIN exam_results er
  ON ea.id = er.attempt_id
WHERE e.is_archived = false  -- Exclude archived exams
GROUP BY s.id, s.student_name, s.code, e.id, e.title, e.exam_type;

-- Create indexes for fast lookups
CREATE INDEX idx_results_summary_student ON results_summary_mv(student_id);
CREATE INDEX idx_results_summary_exam ON results_summary_mv(exam_id);
CREATE INDEX idx_results_summary_code ON results_summary_mv(code);
CREATE INDEX idx_results_summary_score ON results_summary_mv(best_score) WHERE best_score IS NOT NULL;

-- Grant access to authenticated users
GRANT SELECT ON results_summary_mv TO authenticated;

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_results_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY results_summary_mv;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_results_summary() TO authenticated;

COMMENT ON MATERIALIZED VIEW results_summary_mv IS 
  'Pre-aggregated student scores across all exams. Refresh periodically for best performance.';
COMMENT ON FUNCTION refresh_results_summary() IS 
  'Refreshes the results summary materialized view. Call after bulk score updates.';
