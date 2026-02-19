-- Fix: Update student_exam_attempts status when exam is submitted
-- This fixes the issue where submitted exams still show as "in_progress"

-- Step 1: Update the submit_attempt function to also update student_exam_attempts
CREATE OR REPLACE FUNCTION public.submit_attempt(p_attempt_id uuid)
 RETURNS TABLE(total_questions integer, correct_count integer, score_percentage numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
DECLARE
  v_row public.exam_attempts%rowtype;
  v_total integer;
  v_correct integer;
  v_score numeric;
  v_auto numeric;
  v_manual numeric;
  v_max numeric;
  v_final numeric;
BEGIN
  SELECT * INTO v_row FROM public.exam_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'attempt_not_found'; END IF;
  IF v_row.submitted_at IS NOT NULL OR v_row.completion_status = 'submitted' THEN RAISE EXCEPTION 'attempt_already_submitted'; END IF;

  SELECT * INTO v_total, v_correct, v_score, v_auto, v_manual, v_max, v_final
  FROM public.calculate_result_for_attempt(p_attempt_id);

  UPDATE public.exam_attempts
    SET submitted_at = now(), completion_status = 'submitted', updated_at = now()
    WHERE id = p_attempt_id;

  -- Also update student_exam_attempts status to 'completed'
  UPDATE public.student_exam_attempts
    SET status = 'completed', completed_at = now()
    WHERE attempt_id = p_attempt_id;

  RETURN QUERY SELECT v_total, v_correct, v_score;
END;
$function$;

-- Step 2: Fix existing submitted attempts that are still marked as 'in_progress'
UPDATE public.student_exam_attempts sea
SET 
  status = 'completed',
  completed_at = ea.submitted_at
FROM public.exam_attempts ea
WHERE 
  sea.attempt_id = ea.id
  AND ea.completion_status = 'submitted'
  AND ea.submitted_at IS NOT NULL
  AND sea.status = 'in_progress';

-- Step 3: Create a trigger to keep both tables in sync (optional but recommended)
CREATE OR REPLACE FUNCTION sync_student_exam_attempts_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When exam_attempts is updated to submitted, update student_exam_attempts
  IF NEW.completion_status = 'submitted' AND OLD.completion_status != 'submitted' THEN
    UPDATE public.student_exam_attempts
    SET status = 'completed', completed_at = NEW.submitted_at
    WHERE attempt_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS sync_student_exam_attempts_on_submit ON public.exam_attempts;
CREATE TRIGGER sync_student_exam_attempts_on_submit
  AFTER UPDATE ON public.exam_attempts
  FOR EACH ROW
  WHEN (NEW.completion_status = 'submitted' AND OLD.completion_status != 'submitted')
  EXECUTE FUNCTION sync_student_exam_attempts_status();

-- Verification query (run this to check the fix worked)
-- SELECT 
--   sea.status as student_attempt_status,
--   ea.completion_status as exam_attempt_status,
--   ea.submitted_at,
--   COUNT(*) as count
-- FROM student_exam_attempts sea
-- JOIN exam_attempts ea ON sea.attempt_id = ea.id
-- GROUP BY sea.status, ea.completion_status, ea.submitted_at
-- ORDER BY sea.status, ea.completion_status;
