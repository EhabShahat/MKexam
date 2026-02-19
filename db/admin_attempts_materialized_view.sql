-- Materialized View for Admin Attempts List
-- This view pre-computes the expensive JOINs and aggregations used in admin_list_attempts
-- Requirements: 2.1

-- Drop existing view if it exists (for idempotent execution)
DROP MATERIALIZED VIEW IF EXISTS public.admin_attempts_summary CASCADE;

-- Create materialized view with all the data needed for admin_list_attempts
CREATE MATERIALIZED VIEW public.admin_attempts_summary AS
SELECT 
  a.id,
  a.exam_id,
  a.started_at,
  a.submitted_at,
  a.completion_status,
  a.ip_address,
  a.device_info,
  COALESCE(s.student_name, a.student_name) AS student_name,
  s.code,
  er.score_percentage,
  er.final_score_percentage,
  COALESCE(mq.total_manual, 0) AS manual_total_count,
  COALESCE(mg.graded_manual, 0) AS manual_graded_count,
  GREATEST(COALESCE(mq.total_manual, 0) - COALESCE(mg.graded_manual, 0), 0) AS manual_pending_count,
  a.updated_at -- Track when the attempt was last updated for staleness detection
FROM public.exam_attempts a
LEFT JOIN public.students s ON s.id = a.student_id
LEFT JOIN public.exam_results er ON er.attempt_id = a.id
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS total_manual
  FROM public.questions q
  WHERE q.exam_id = a.exam_id
    AND q.question_type IN ('paragraph','photo_upload')
) mq ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS graded_manual
  FROM public.manual_grades g
  JOIN public.questions q ON q.id = g.question_id
  WHERE g.attempt_id = a.id
    AND q.exam_id = a.exam_id
) mg ON true;

-- Create indexes on the materialized view for efficient querying
-- Index on exam_id and completion_status for filtering
CREATE INDEX idx_admin_attempts_summary_exam_status 
ON public.admin_attempts_summary(exam_id, completion_status);

-- Index on exam_id and started_at for sorting
CREATE INDEX idx_admin_attempts_summary_exam_started 
ON public.admin_attempts_summary(exam_id, started_at DESC);

-- Index on id for quick lookups
CREATE UNIQUE INDEX idx_admin_attempts_summary_id 
ON public.admin_attempts_summary(id);

-- Function to refresh the materialized view incrementally for a specific attempt
-- This is much faster than REFRESH MATERIALIZED VIEW for single-row updates
CREATE OR REPLACE FUNCTION public.refresh_admin_attempts_summary_incremental(p_attempt_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  -- Delete the old row from the materialized view
  DELETE FROM public.admin_attempts_summary WHERE id = p_attempt_id;
  
  -- Insert the updated row
  INSERT INTO public.admin_attempts_summary
  SELECT 
    a.id,
    a.exam_id,
    a.started_at,
    a.submitted_at,
    a.completion_status,
    a.ip_address,
    a.device_info,
    COALESCE(s.student_name, a.student_name) AS student_name,
    s.code,
    er.score_percentage,
    er.final_score_percentage,
    COALESCE(mq.total_manual, 0) AS manual_total_count,
    COALESCE(mg.graded_manual, 0) AS manual_graded_count,
    GREATEST(COALESCE(mq.total_manual, 0) - COALESCE(mg.graded_manual, 0), 0) AS manual_pending_count,
    a.updated_at
  FROM public.exam_attempts a
  LEFT JOIN public.students s ON s.id = a.student_id
  LEFT JOIN public.exam_results er ON er.attempt_id = a.id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total_manual
    FROM public.questions q
    WHERE q.exam_id = a.exam_id
      AND q.question_type IN ('paragraph','photo_upload')
  ) mq ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS graded_manual
    FROM public.manual_grades g
    JOIN public.questions q ON q.id = g.question_id
    WHERE g.attempt_id = a.id
      AND q.exam_id = a.exam_id
  ) mg ON true
  WHERE a.id = p_attempt_id;
END;
$function$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.refresh_admin_attempts_summary_incremental(uuid) TO service_role;

-- Trigger function to automatically refresh the materialized view when attempts are updated
CREATE OR REPLACE FUNCTION public.trigger_refresh_admin_attempts_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  -- Refresh the materialized view row for this attempt
  -- Use NEW.id for INSERT/UPDATE, OLD.id for DELETE
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.admin_attempts_summary WHERE id = OLD.id;
    RETURN OLD;
  ELSE
    PERFORM public.refresh_admin_attempts_summary_incremental(NEW.id);
    RETURN NEW;
  END IF;
END;
$function$;

-- Create trigger on exam_attempts to refresh materialized view on changes
DROP TRIGGER IF EXISTS trigger_refresh_admin_attempts_on_attempt_change ON public.exam_attempts;
CREATE TRIGGER trigger_refresh_admin_attempts_on_attempt_change
  AFTER INSERT OR UPDATE OR DELETE ON public.exam_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_refresh_admin_attempts_summary();

-- Trigger function for exam_results table (uses attempt_id column)
CREATE OR REPLACE FUNCTION public.trigger_refresh_admin_attempts_on_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_admin_attempts_summary_incremental(OLD.attempt_id);
    RETURN OLD;
  ELSE
    PERFORM public.refresh_admin_attempts_summary_incremental(NEW.attempt_id);
    RETURN NEW;
  END IF;
END;
$function$;

-- Trigger function for manual_grades table (uses attempt_id column)
CREATE OR REPLACE FUNCTION public.trigger_refresh_admin_attempts_on_grade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_admin_attempts_summary_incremental(OLD.attempt_id);
    RETURN OLD;
  ELSE
    PERFORM public.refresh_admin_attempts_summary_incremental(NEW.attempt_id);
    RETURN NEW;
  END IF;
END;
$function$;

-- Create trigger on exam_results to refresh when results are calculated
DROP TRIGGER IF EXISTS trigger_refresh_admin_attempts_on_result_change ON public.exam_results;
CREATE TRIGGER trigger_refresh_admin_attempts_on_result_change
  AFTER INSERT OR UPDATE OR DELETE ON public.exam_results
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_refresh_admin_attempts_on_result();

-- Create trigger on manual_grades to refresh when manual grades change
DROP TRIGGER IF EXISTS trigger_refresh_admin_attempts_on_grade_change ON public.manual_grades;
CREATE TRIGGER trigger_refresh_admin_attempts_on_grade_change
  AFTER INSERT OR UPDATE OR DELETE ON public.manual_grades
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_refresh_admin_attempts_on_grade();

-- Note: Initial population of the materialized view
-- Run this after creating the view to populate it with existing data
-- REFRESH MATERIALIZED VIEW public.admin_attempts_summary;
