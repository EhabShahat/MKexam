-- Migration: Fix score calculations to count non-attempted exams as 0%
-- Date: 2025-01-XX
-- Description: Updates homework and quiz score calculations to use total score / total exams
--              instead of averaging only attempted exams

-- Drop existing functions
DROP FUNCTION IF EXISTS sync_homework_and_quiz_scores();
DROP FUNCTION IF EXISTS sync_all_extra_scores();
DROP FUNCTION IF EXISTS sync_student_extra_scores(uuid);

-- Recreate sync_homework_and_quiz_scores with fixed logic
CREATE OR REPLACE FUNCTION sync_homework_and_quiz_scores()
RETURNS TABLE(
  student_id uuid,
  student_code text,
  homework_score numeric,
  quiz_score numeric
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH homework_exams AS (
    SELECT COUNT(*) as total_count
    FROM exams
    WHERE exam_type = 'homework' AND status = 'done'
  ),
  quiz_exams AS (
    SELECT COUNT(*) as total_count
    FROM exams
    WHERE exam_type = 'quiz' AND status = 'done'
  ),
  homework_scores AS (
    SELECT 
      s.id as student_id,
      s.code as student_code,
      COALESCE(SUM(COALESCE(er.final_score_percentage, er.score_percentage)), 0) as total_homework_score,
      (SELECT total_count FROM homework_exams) as total_homework_exams
    FROM students s
    LEFT JOIN exam_attempts ea ON ea.student_id = s.id AND ea.completion_status = 'submitted'
    LEFT JOIN exams e ON e.id = ea.exam_id AND e.exam_type = 'homework' AND e.status = 'done'
    LEFT JOIN exam_results er ON er.attempt_id = ea.id
    GROUP BY s.id, s.code
  ),
  quiz_scores AS (
    SELECT 
      s.id as student_id,
      s.code as student_code,
      COALESCE(SUM(COALESCE(er.final_score_percentage, er.score_percentage)), 0) as total_quiz_score,
      (SELECT total_count FROM quiz_exams) as total_quiz_exams
    FROM students s
    LEFT JOIN exam_attempts ea ON ea.student_id = s.id AND ea.completion_status = 'submitted'
    LEFT JOIN exams e ON e.id = ea.exam_id AND e.exam_type = 'quiz' AND e.status = 'done'
    LEFT JOIN exam_results er ON er.attempt_id = ea.id
    GROUP BY s.id, s.code
  )
  SELECT 
    s.id as student_id,
    s.code as student_code,
    CASE 
      WHEN h.total_homework_exams > 0 THEN ROUND(h.total_homework_score / h.total_homework_exams)
      ELSE 0
    END as homework_score,
    CASE 
      WHEN q.total_quiz_exams > 0 THEN ROUND(q.total_quiz_score / q.total_quiz_exams)
      ELSE 0
    END as quiz_score
  FROM students s
  LEFT JOIN homework_scores h ON h.student_id = s.id
  LEFT JOIN quiz_scores q ON q.student_id = s.id
  ORDER BY s.code;
END;
$$;

-- Recreate sync_all_extra_scores with fixed logic
CREATE OR REPLACE FUNCTION sync_all_extra_scores()
RETURNS TABLE(
  updated_count bigint,
  message text
) LANGUAGE plpgsql AS $$
DECLARE
  update_count bigint := 0;
BEGIN
  WITH attendance_stats AS (
    SELECT 
      s.id as student_id,
      CASE 
        WHEN (SELECT COUNT(DISTINCT session_date) FROM attendance_records) > 0 THEN 
          ROUND((COALESCE(COUNT(DISTINCT ar.session_date), 0)::numeric / (SELECT COUNT(DISTINCT session_date) FROM attendance_records)::numeric) * 100)
        ELSE 0
      END as attendance_percentage
    FROM students s
    LEFT JOIN attendance_records ar ON ar.student_id = s.id
    GROUP BY s.id
  )
  UPDATE extra_scores es
  SET 
    data = jsonb_set(
      COALESCE(es.data, '{}'::jsonb),
      '{attendance_percentage}',
      to_jsonb(ast.attendance_percentage)
    ),
    updated_at = NOW()
  FROM attendance_stats ast
  WHERE es.student_id = ast.student_id;
  
  GET DIAGNOSTICS update_count = ROW_COUNT;
  
  WITH homework_exams AS (
    SELECT COUNT(*) as total_count
    FROM exams
    WHERE exam_type = 'homework' AND status = 'done'
  ),
  quiz_exams AS (
    SELECT COUNT(*) as total_count
    FROM exams
    WHERE exam_type = 'quiz' AND status = 'done'
  ),
  homework_scores AS (
    SELECT 
      s.id as student_id,
      COALESCE(SUM(COALESCE(er.final_score_percentage, er.score_percentage)), 0) as total_homework_score,
      (SELECT total_count FROM homework_exams) as total_homework_exams
    FROM students s
    LEFT JOIN exam_attempts ea ON ea.student_id = s.id AND ea.completion_status = 'submitted'
    LEFT JOIN exams e ON e.id = ea.exam_id AND e.exam_type = 'homework' AND e.status = 'done'
    LEFT JOIN exam_results er ON er.attempt_id = ea.id
    GROUP BY s.id
  ),
  quiz_scores AS (
    SELECT 
      s.id as student_id,
      COALESCE(SUM(COALESCE(er.final_score_percentage, er.score_percentage)), 0) as total_quiz_score,
      (SELECT total_count FROM quiz_exams) as total_quiz_exams
    FROM students s
    LEFT JOIN exam_attempts ea ON ea.student_id = s.id AND ea.completion_status = 'submitted'
    LEFT JOIN exams e ON e.id = ea.exam_id AND e.exam_type = 'quiz' AND e.status = 'done'
    LEFT JOIN exam_results er ON er.attempt_id = ea.id
    GROUP BY s.id
  ),
  combined_scores AS (
    SELECT 
      s.id as student_id,
      CASE 
        WHEN h.total_homework_exams > 0 THEN ROUND(h.total_homework_score / h.total_homework_exams)
        ELSE 0
      END as homework_score,
      CASE 
        WHEN q.total_quiz_exams > 0 THEN ROUND(q.total_quiz_score / q.total_quiz_exams)
        ELSE 0
      END as quiz_score
    FROM students s
    LEFT JOIN homework_scores h ON h.student_id = s.id
    LEFT JOIN quiz_scores q ON q.student_id = s.id
  )
  UPDATE extra_scores es
  SET 
    data = jsonb_set(
      jsonb_set(
        COALESCE(es.data, '{}'::jsonb),
        '{exam_type_homework}',
        to_jsonb(cs.homework_score)
      ),
      '{exam_type_quiz}',
      to_jsonb(cs.quiz_score)
    ),
    updated_at = NOW()
  FROM combined_scores cs
  WHERE es.student_id = cs.student_id;
  
  RETURN QUERY SELECT update_count, 'Successfully synced attendance, homework, and quiz scores for all students'::text;
END;
$$;

-- Recreate sync_student_extra_scores with fixed logic
CREATE OR REPLACE FUNCTION sync_student_extra_scores(p_student_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_attendance_percentage numeric;
  v_homework_score numeric;
  v_quiz_score numeric;
  v_total_sessions bigint;
  v_total_homework bigint;
  v_total_quiz bigint;
  v_homework_sum numeric;
  v_quiz_sum numeric;
BEGIN
  SELECT COUNT(DISTINCT session_date) INTO v_total_sessions FROM attendance_records;
  
  SELECT 
    CASE 
      WHEN v_total_sessions > 0 THEN 
        ROUND((COALESCE(COUNT(DISTINCT ar.session_date), 0)::numeric / v_total_sessions::numeric) * 100)
      ELSE 0
    END
  INTO v_attendance_percentage
  FROM attendance_records ar
  WHERE ar.student_id = p_student_id;
  
  SELECT COUNT(*) INTO v_total_homework
  FROM exams
  WHERE exam_type = 'homework' AND status = 'done';
  
  SELECT COALESCE(SUM(COALESCE(er.final_score_percentage, er.score_percentage)), 0)
  INTO v_homework_sum
  FROM exam_attempts ea
  JOIN exams e ON e.id = ea.exam_id
  JOIN exam_results er ON er.attempt_id = ea.id
  WHERE ea.student_id = p_student_id
    AND e.exam_type = 'homework'
    AND e.status = 'done'
    AND ea.completion_status = 'submitted';
  
  IF v_total_homework > 0 THEN
    v_homework_score := ROUND(v_homework_sum / v_total_homework);
  ELSE
    v_homework_score := 0;
  END IF;
  
  SELECT COUNT(*) INTO v_total_quiz
  FROM exams
  WHERE exam_type = 'quiz' AND status = 'done';
  
  SELECT COALESCE(SUM(COALESCE(er.final_score_percentage, er.score_percentage)), 0)
  INTO v_quiz_sum
  FROM exam_attempts ea
  JOIN exams e ON e.id = ea.exam_id
  JOIN exam_results er ON er.attempt_id = ea.id
  WHERE ea.student_id = p_student_id
    AND e.exam_type = 'quiz'
    AND e.status = 'done'
    AND ea.completion_status = 'submitted';
  
  IF v_total_quiz > 0 THEN
    v_quiz_score := ROUND(v_quiz_sum / v_total_quiz);
  ELSE
    v_quiz_score := 0;
  END IF;
  
  INSERT INTO extra_scores (student_id, data, updated_at)
  VALUES (
    p_student_id,
    jsonb_build_object(
      'attendance_percentage', COALESCE(v_attendance_percentage, 0),
      'exam_type_homework', COALESCE(v_homework_score, 0),
      'exam_type_quiz', COALESCE(v_quiz_score, 0)
    ),
    NOW()
  )
  ON CONFLICT (student_id) DO UPDATE
  SET 
    data = jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(extra_scores.data, '{}'::jsonb),
          '{attendance_percentage}',
          to_jsonb(COALESCE(v_attendance_percentage, 0))
        ),
        '{exam_type_homework}',
        to_jsonb(COALESCE(v_homework_score, 0))
      ),
      '{exam_type_quiz}',
      to_jsonb(COALESCE(v_quiz_score, 0))
    ),
    updated_at = NOW();
END;
$$;

-- Add comments
COMMENT ON FUNCTION sync_all_extra_scores() IS 'Syncs attendance, homework, and quiz scores for all students. Non-attempted exams count as 0%.';
COMMENT ON FUNCTION sync_student_extra_scores(uuid) IS 'Syncs extra scores for a single student. Non-attempted exams count as 0%.';
COMMENT ON FUNCTION sync_homework_and_quiz_scores() IS 'Calculates homework and quiz scores. Non-attempted exams count as 0%.';
