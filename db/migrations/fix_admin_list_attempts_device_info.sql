-- Migration: Add device_info and code fields to admin_list_attempts RPC
-- Date: 2026-02-07
-- Issue: Device names showing as "Unknown Device" in results table
-- Root Cause: admin_list_attempts RPC was missing device_info and code columns

-- Drop and recreate the function with the missing fields
DROP FUNCTION IF EXISTS public.admin_list_attempts(uuid);

CREATE OR REPLACE FUNCTION public.admin_list_attempts(p_exam_id uuid)
RETURNS TABLE (
  id uuid,
  exam_id uuid,
  started_at timestamptz,
  submitted_at timestamptz,
  completion_status text,
  ip_address inet,
  device_info jsonb,
  student_name text,
  code text,
  score_percentage numeric,
  final_score_percentage numeric,
  manual_total_count integer,
  manual_graded_count integer,
  manual_pending_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT a.id,
         a.exam_id,
         a.started_at,
         a.submitted_at,
         a.completion_status,
         a.ip_address,
         a.device_info,
         coalesce(s.student_name, a.student_name) as student_name,
         s.code,
         er.score_percentage,
         er.final_score_percentage,
         COALESCE(mq.total_manual, 0) AS manual_total_count,
         COALESCE(mg.graded_manual, 0) AS manual_graded_count,
         GREATEST(COALESCE(mq.total_manual, 0) - COALESCE(mg.graded_manual, 0), 0) AS manual_pending_count
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
  WHERE a.exam_id = p_exam_id
  ORDER BY a.started_at desc nulls first;
END;
$function$;

-- Restore grants
GRANT EXECUTE ON FUNCTION public.admin_list_attempts(uuid) TO service_role;

-- Verification query (run after migration)
-- SELECT id, student_name, code, device_info->>'friendlyName' as device_name 
-- FROM public.admin_list_attempts('your-exam-id-here') 
-- LIMIT 5;
