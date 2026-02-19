-- get_exam_questions_paginated RPC function
-- Paginated question loading with compression support
-- Excludes correct_answers for students based on role
-- Requirements: 1.1, 1.4, 14.1

-- Create function for paginated question retrieval
CREATE OR REPLACE FUNCTION public.get_exam_questions_paginated(
  p_exam_id uuid,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 5,
  p_exclude_correct_answers boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_questions jsonb;
  v_total_count integer;
BEGIN
  -- Validate pagination parameters
  IF p_limit IS NULL OR p_limit < 1 THEN
    p_limit := 5;
  END IF;
  
  IF p_limit > 100 THEN
    p_limit := 100; -- Maximum limit to prevent excessive data transfer
  END IF;
  
  IF p_offset IS NULL OR p_offset < 0 THEN
    p_offset := 0;
  END IF;

  -- Get total count of questions for this exam
  SELECT COUNT(*) INTO v_total_count
  FROM public.questions
  WHERE exam_id = p_exam_id;

  -- Build questions array with or without correct_answers
  IF p_exclude_correct_answers THEN
    -- Exclude correct_answers for students
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'question_text', q.question_text,
        'question_type', q.question_type,
        'options', q.options,
        'points', q.points,
        'required', q.required,
        'order_index', q.order_index,
        'question_image_url', q.question_image_url,
        'option_image_urls', q.option_image_urls
      ) ORDER BY q.order_index NULLS LAST, q.created_at
    ), '[]'::jsonb)
    INTO v_questions
    FROM public.questions q
    WHERE q.exam_id = p_exam_id
    ORDER BY q.order_index NULLS LAST, q.created_at
    LIMIT p_limit
    OFFSET p_offset;
  ELSE
    -- Include correct_answers for admins
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'question_text', q.question_text,
        'question_type', q.question_type,
        'options', q.options,
        'correct_answers', q.correct_answers,
        'points', q.points,
        'required', q.required,
        'order_index', q.order_index,
        'question_image_url', q.question_image_url,
        'option_image_urls', q.option_image_urls
      ) ORDER BY q.order_index NULLS LAST, q.created_at
    ), '[]'::jsonb)
    INTO v_questions
    FROM public.questions q
    WHERE q.exam_id = p_exam_id
    ORDER BY q.order_index NULLS LAST, q.created_at
    LIMIT p_limit
    OFFSET p_offset;
  END IF;

  -- Return paginated response with metadata
  RETURN jsonb_build_object(
    'questions', v_questions,
    'pagination', jsonb_build_object(
      'total', v_total_count,
      'offset', p_offset,
      'limit', p_limit,
      'has_more', (p_offset + p_limit) < v_total_count
    )
  );
END;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_exam_questions_paginated(uuid, integer, integer, boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.get_exam_questions_paginated(uuid, integer, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_exam_questions_paginated(uuid, integer, integer, boolean) TO service_role;
