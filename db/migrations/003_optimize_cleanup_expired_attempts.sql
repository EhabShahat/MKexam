-- Migration: Optimize cleanup_expired_attempts to reduce lock contention
-- This fixes test timeouts caused by the cleanup cron job holding ExclusiveLock
-- on exam_attempts table for 110+ seconds

-- Optimized cleanup_expired_attempts() with batch processing
CREATE OR REPLACE FUNCTION public.cleanup_expired_attempts()
 RETURNS TABLE(auto_submitted_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
DECLARE
  v_count integer := 0;
  v_batch_count integer;
  v_batch_limit integer := 50; -- Process 50 attempts at a time
  v_max_iterations integer := 100; -- Safety limit to prevent infinite loops
  v_iteration integer := 0;
BEGIN
  -- Process expired attempts in batches to reduce lock contention
  LOOP
    v_iteration := v_iteration + 1;
    
    -- Safety check: prevent infinite loops
    IF v_iteration > v_max_iterations THEN
      RAISE WARNING 'cleanup_expired_attempts: reached max iterations (%), stopping', v_max_iterations;
      EXIT;
    END IF;

    -- Batch update: mark expired attempts as submitted
    -- This is much faster than row-by-row iteration
    WITH expired_batch AS (
      SELECT a.id
      FROM public.exam_attempts a
      JOIN public.exams e ON e.id = a.exam_id
      WHERE a.submitted_at IS NULL
        AND a.completion_status = 'in_progress'
        AND (
          (e.duration_minutes IS NOT NULL AND now() >= a.started_at + make_interval(mins => e.duration_minutes))
          OR (e.end_time IS NOT NULL AND now() >= e.end_time)
        )
      LIMIT v_batch_limit
      FOR UPDATE SKIP LOCKED -- Skip locked rows to avoid blocking
    ),
    updated AS (
      UPDATE public.exam_attempts a
      SET 
        submitted_at = now(),
        completion_status = 'submitted',
        updated_at = now()
      FROM expired_batch eb
      WHERE a.id = eb.id
      RETURNING a.id, a.exam_id
    )
    SELECT COUNT(*) INTO v_batch_count FROM updated;

    -- Calculate results for the batch
    -- This is done after the UPDATE to minimize lock time
    PERFORM public.calculate_result_for_attempt(u.id)
    FROM (SELECT id FROM updated) u;

    -- Update student_exam_attempts status
    UPDATE public.student_exam_attempts sea
    SET status = 'completed', completed_at = now()
    FROM (SELECT id FROM updated) u
    WHERE sea.attempt_id = u.id AND sea.completed_at IS NULL;

    v_count := v_count + v_batch_count;

    -- Exit if no more expired attempts found
    EXIT WHEN v_batch_count = 0;
    
    -- Small delay between batches to allow other operations
    PERFORM pg_sleep(0.1);
  END LOOP;

  RETURN QUERY SELECT v_count;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return count processed so far
    RAISE WARNING 'cleanup_expired_attempts error after % attempts: %', v_count, SQLERRM;
    RETURN QUERY SELECT v_count;
END;
$function$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.cleanup_expired_attempts() TO service_role;

-- Add comment explaining the optimization
COMMENT ON FUNCTION public.cleanup_expired_attempts() IS 
'Auto-submits expired in-progress attempts in batches of 50. Uses SKIP LOCKED to avoid blocking other operations. Processes up to 5000 attempts per run (100 iterations × 50 batch size).';
