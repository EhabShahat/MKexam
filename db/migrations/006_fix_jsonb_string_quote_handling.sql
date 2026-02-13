-- Migration: Fix JSONB string to text conversion to strip quotes
-- When converting JSONB strings to text with ::text, PostgreSQL includes the quotes
-- This causes comparison failures: "A" != A

CREATE OR REPLACE FUNCTION public.calculate_result_for_attempt(p_attempt_id uuid)
RETURNS TABLE(
  total_questions integer,
  correct_count integer,
  score_percentage numeric,
  auto_points numeric,
  manual_points numeric,
  max_points numeric,
  final_score_percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_row public.exam_attempts%rowtype;
  v_total int;
  v_correct int;
  v_score numeric;
  v_auto_points numeric;
  v_manual_points numeric;
  v_max_points numeric;
  v_final numeric;
BEGIN
  SELECT * INTO v_row FROM public.exam_attempts WHERE id = p_attempt_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'attempt_not_found'; END IF;

  WITH q AS (
    SELECT q.id, q.question_type, q.correct_answers, COALESCE(q.points, 1) AS points,
           COALESCE(q.auto_grade_on_answer, false) AS auto_grade_on_answer
    FROM public.questions q
    WHERE q.exam_id = v_row.exam_id
  ),
  ans AS (
    SELECT q.id, q.question_type, q.correct_answers, q.points, q.auto_grade_on_answer,
           (v_row.answers -> (q.id::text)) AS student_json
    FROM q
  ),
  norm AS (
    SELECT a.id, a.question_type, a.correct_answers, a.student_json, a.points, a.auto_grade_on_answer,
           -- Handle student answers: can be array, string, or null
           -- Use #>> to extract text without quotes instead of ::text
           CASE WHEN a.question_type IN ('multiple_choice','multi_select') THEN
             CASE
               WHEN a.student_json IS NULL THEN ARRAY[]::text[]
               WHEN jsonb_typeof(a.student_json) = 'array' THEN
                 COALESCE((SELECT ARRAY(SELECT jsonb_array_elements_text(a.student_json) ORDER BY 1)), ARRAY[]::text[])
               WHEN jsonb_typeof(a.student_json) = 'string' THEN
                 ARRAY[a.student_json #>> '{}']  -- Extract string value without quotes
               ELSE ARRAY[]::text[]
             END
           ELSE NULL END AS s_arr,
           -- Handle correct answers: can be array, string, or boolean
           CASE WHEN a.question_type IN ('multiple_choice','multi_select') THEN
             CASE 
               WHEN jsonb_typeof(a.correct_answers) = 'array' THEN
                 COALESCE((SELECT ARRAY(SELECT jsonb_array_elements_text(a.correct_answers) ORDER BY 1)), ARRAY[]::text[])
               WHEN jsonb_typeof(a.correct_answers) = 'string' THEN
                 ARRAY[a.correct_answers #>> '{}']  -- Extract string value without quotes
               ELSE ARRAY[]::text[]
             END
           ELSE NULL END AS c_arr
    FROM ans a
  ),
  graded AS (
    SELECT n.id, n.question_type, n.points,
           CASE
             -- Auto-grade paragraph/photo_upload if auto_grade_on_answer is enabled and answer exists
             WHEN n.question_type IN ('paragraph','photo_upload') AND n.auto_grade_on_answer = true THEN
               CASE
                 WHEN n.student_json IS NULL THEN FALSE
                 WHEN jsonb_typeof(n.student_json) = 'string' THEN
                   CASE WHEN trim(n.student_json #>> '{}') <> '' THEN TRUE ELSE FALSE END
                 ELSE TRUE
               END
             -- Manual grading required for paragraph/photo_upload without auto_grade_on_answer
             WHEN n.question_type IN ('paragraph','photo_upload') THEN NULL
             WHEN n.question_type IN ('true_false','single_choice') THEN
               CASE
                 WHEN n.student_json IS NULL THEN FALSE
                 -- Handle boolean, string, or array correct_answers
                 WHEN jsonb_typeof(n.correct_answers) = 'boolean' THEN
                   (n.student_json = n.correct_answers)
                 WHEN jsonb_typeof(n.correct_answers) = 'string' THEN
                   -- Use #>> to extract without quotes
                   ((n.student_json #>> '{}') = (n.correct_answers #>> '{}'))
                 WHEN jsonb_typeof(n.correct_answers) = 'array' THEN
                   CASE
                     WHEN jsonb_array_length(n.correct_answers) = 1 THEN
                       ((n.student_json #>> '{}') = (n.correct_answers->0 #>> '{}'))
                     ELSE FALSE
                   END
                 ELSE FALSE
               END
             WHEN n.question_type IN ('multiple_choice','multi_select') THEN
               COALESCE(n.s_arr, ARRAY[]::text[]) = COALESCE(n.c_arr, ARRAY[]::text[])
             ELSE FALSE
           END AS is_correct
    FROM norm n
  )
  SELECT
    COUNT(*) FILTER (WHERE is_correct IS NOT NULL) AS total_q,
    COUNT(*) FILTER (WHERE is_correct IS TRUE) AS correct_cnt,
    SUM(points) AS all_points,
    SUM(CASE WHEN is_correct IS TRUE THEN points ELSE 0 END) AS auto_pts
  INTO v_total, v_correct, v_max_points, v_auto_points
  FROM graded;

  v_score := CASE WHEN v_total > 0 THEN ROUND((v_correct::numeric * 100.0) / v_total, 2) ELSE 0 END;

  SELECT COALESCE(SUM(LEAST(mg.awarded_points, COALESCE(q.points, 1))), 0)
  INTO v_manual_points
  FROM public.manual_grades mg
  JOIN public.questions q ON q.id = mg.question_id
  WHERE mg.attempt_id = p_attempt_id AND q.exam_id = v_row.exam_id;

  v_final := CASE WHEN COALESCE(v_max_points,0) > 0 THEN ROUND(((COALESCE(v_auto_points,0) + COALESCE(v_manual_points,0)) / v_max_points) * 100.0, 2) ELSE 0 END;

  INSERT INTO public.exam_results(
    attempt_id, total_questions, correct_count, score_percentage,
    auto_points, manual_points, max_points, final_score_percentage, calculated_at
  )
  VALUES (
    p_attempt_id, v_total, v_correct, v_score,
    COALESCE(v_auto_points,0), COALESCE(v_manual_points,0), COALESCE(v_max_points,0), v_final, now()
  )
  ON CONFLICT (attempt_id) DO UPDATE SET
    total_questions = EXCLUDED.total_questions,
    correct_count = EXCLUDED.correct_count,
    score_percentage = EXCLUDED.score_percentage,
    auto_points = EXCLUDED.auto_points,
    manual_points = EXCLUDED.manual_points,
    max_points = EXCLUDED.max_points,
    final_score_percentage = EXCLUDED.final_score_percentage,
    calculated_at = now();

  RETURN QUERY SELECT v_total, v_correct, v_score, COALESCE(v_auto_points,0), COALESCE(v_manual_points,0), COALESCE(v_max_points,0), v_final;
END;
$function$;

COMMENT ON FUNCTION public.calculate_result_for_attempt(uuid) IS 
'Calculates exam results with proper JSONB string handling. Uses #>> operator to extract text values without quotes for accurate comparisons.';
