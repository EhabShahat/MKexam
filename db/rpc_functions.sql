-- RPC functions for Exam App
-- This file defines all RPCs required by the app.
-- Safe to run multiple times due to CREATE OR REPLACE.

-- Ensure pgcrypto for gen_random_uuid/gen_random_bytes
create extension if not exists pgcrypto;

-- resolved merge marker
-- Ensure exam_attempts has device_info column (idempotent)
alter table if exists public.exam_attempts add column if not exists device_info jsonb;

-- Attempt activity events table (idempotent)
create table if not exists public.attempt_activity_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  event_type text not null,
  event_time timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Helpful indexes for querying
create index if not exists idx_activity_attempt_time on public.attempt_activity_events (attempt_id, event_time desc);
create index if not exists idx_activity_event_type on public.attempt_activity_events (event_type);

-- Batch log attempt activity events
CREATE OR REPLACE FUNCTION public.log_attempt_activity(p_attempt_id uuid, p_events jsonb)
RETURNS TABLE(inserted_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_attempt_id IS NULL THEN
    RAISE EXCEPTION 'invalid_attempt_id';
  END IF;

  INSERT INTO public.attempt_activity_events (attempt_id, event_type, event_time, payload)
  SELECT
    p_attempt_id,
    left(coalesce(e->>'event_type', 'unknown'), 64),
    COALESCE((e->>'event_time')::timestamptz, now()),
    COALESCE(e->'payload', '{}'::jsonb)
  FROM jsonb_array_elements(COALESCE(p_events, '[]'::jsonb)) AS e;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT v_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.log_attempt_activity(uuid, jsonb) TO service_role;
-- Execute arbitrary SQL passed from the server (service role only)
-- Splits by semicolons and executes each non-empty, non-comment statement.
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  stmt text;
BEGIN
  FOREACH stmt IN ARRAY regexp_split_to_array(sql, ';')
  LOOP
    stmt := trim(stmt);
    IF stmt IS NULL OR stmt = '' OR left(stmt, 2) = '--' THEN
      CONTINUE;
    END IF;
    EXECUTE stmt;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

-- Calculate/refresh results for a specific attempt (points-based with manual grades)
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
           CASE WHEN a.question_type IN ('multiple_choice','multi_select') THEN
             COALESCE((SELECT ARRAY(SELECT jsonb_array_elements_text(a.student_json) ORDER BY 1)), ARRAY[]::text[])
           ELSE NULL END AS s_arr,
           CASE WHEN a.question_type IN ('multiple_choice','multi_select') THEN
             COALESCE((SELECT ARRAY(SELECT jsonb_array_elements_text(a.correct_answers) ORDER BY 1)), ARRAY[]::text[])
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
                   -- For strings, check if not empty after trimming
                   CASE WHEN trim(both '"' from n.student_json::text) <> '' THEN TRUE ELSE FALSE END
                 ELSE TRUE
               END
             -- Manual grading required for paragraph/photo_upload without auto_grade_on_answer
             WHEN n.question_type IN ('paragraph','photo_upload') THEN NULL
             WHEN n.question_type IN ('true_false','single_choice') THEN
               CASE
                 WHEN n.student_json IS NULL THEN FALSE
                 WHEN jsonb_typeof(n.correct_answers) = 'array' AND jsonb_array_length(n.correct_answers) = 1 THEN
                   (n.student_json::text = (n.correct_answers->0)::text)
                 ELSE n.student_json::text = n.correct_answers::text
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

-- get_attempt_state(uuid) -> jsonb
CREATE OR REPLACE FUNCTION public.get_attempt_state(p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
DECLARE
  v_row public.exam_attempts%rowtype;
  v_exam public.exams%rowtype;
  v_json jsonb;
BEGIN
  select * into v_row from public.exam_attempts where id=p_attempt_id;
  if not found then raise exception 'attempt_not_found'; end if;
  select * into v_exam from public.exams where id=v_row.exam_id;

  -- SERVER-SIDE VALIDATION: Validate started_at timestamp to prevent client-side issues
  -- This catches corrupted data before it reaches the browser
  
  -- Validation 1: started_at must not be null
  if v_row.started_at is null then
    raise exception 'invalid_attempt_data: started_at is null';
  end if;
  
  -- Validation 2: started_at must not be in the future (allow 5 min clock skew)
  if v_row.started_at > (now() + interval '5 minutes') then
    raise exception 'invalid_attempt_data: started_at is in the future (%, current time %)', 
      v_row.started_at, now();
  end if;
  
  -- Validation 3: started_at must not be older than 1 year (catches corrupted data)
  if v_row.started_at < (now() - interval '1 year') then
    raise exception 'invalid_attempt_data: started_at is more than 1 year old (%, current time %)', 
      v_row.started_at, now();
  end if;
  
  -- Validation 4: If duration_minutes is set, validate it's reasonable (0-1440 minutes = 24 hours)
  if v_exam.duration_minutes is not null then
    if v_exam.duration_minutes < 0 then
      raise exception 'invalid_exam_data: duration_minutes is negative (%)', v_exam.duration_minutes;
    end if;
    if v_exam.duration_minutes > 1440 then
      raise exception 'invalid_exam_data: duration_minutes exceeds 24 hours (%)', v_exam.duration_minutes;
    end if;
  end if;
  
  -- Validation 5: If end_time is set, validate it's not before start_time
  if v_exam.end_time is not null and v_exam.start_time is not null then
    if v_exam.end_time < v_exam.start_time then
      raise exception 'invalid_exam_data: end_time (%) is before start_time (%)', 
        v_exam.end_time, v_exam.start_time;
    end if;
  end if;

  v_json := jsonb_build_object(
    'attemptId', v_row.id,
    'version', v_row.version,
    'started_at', v_row.started_at,
    'exam', jsonb_build_object(
      'id', v_exam.id,
      'title', v_exam.title,
      'description', v_exam.description,
      'start_time', v_exam.start_time,
      'end_time', v_exam.end_time,
      'duration_minutes', v_exam.duration_minutes,
      'settings', v_exam.settings,
      'access_type', v_exam.access_type
    ),
    'auto_save_data', v_row.auto_save_data,
    'answers', v_row.answers,
    'completion_status', v_row.completion_status,
    'submitted_at', v_row.submitted_at
  );

  v_json := v_json || jsonb_build_object(
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id,
        'question_text', q.question_text,
        'question_type', q.question_type,
        'options', q.options,
        'points', q.points,
        'required', q.required,
        'order_index', q.order_index,
        'question_image_url', q.question_image_url,
        'option_image_urls', q.option_image_urls
      ) order by q.order_index nulls last, q.created_at), '[]'::jsonb)
      from public.questions q where q.exam_id = v_row.exam_id
    )
  );

  return v_json;
END;
$function$;

-- save_attempt(uuid,jsonb,jsonb,int) -> table(new_version int)
CREATE OR REPLACE FUNCTION public.save_attempt(p_attempt_id uuid, p_answers jsonb, p_auto_save_data jsonb, p_expected_version integer)
 RETURNS TABLE(new_version integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
DECLARE
  v_row public.exam_attempts%rowtype;
BEGIN
  select * into v_row from public.exam_attempts where id=p_attempt_id for update;
  if not found then raise exception 'attempt_not_found'; end if;
  if v_row.submitted_at is not null or v_row.completion_status='submitted' then raise exception 'attempt_already_submitted'; end if;
  if v_row.version <> p_expected_version then raise exception 'version_mismatch'; end if;

  update public.exam_attempts
  set answers = coalesce(p_answers, '{}'::jsonb),
      auto_save_data = coalesce(p_auto_save_data, '{}'::jsonb),
      version = v_row.version + 1,
      updated_at = now()
  where id = p_attempt_id;

  return query select v_row.version + 1;
END;
$function$;

-- start_attempt(uuid,text,text,inet) -> table(attempt_id uuid, seed text)
CREATE OR REPLACE FUNCTION public.start_attempt(p_exam_id uuid, p_code text, p_student_name text, p_ip inet)
 RETURNS TABLE(attempt_id uuid, seed text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
DECLARE
  v_exam public.exams%rowtype;
  v_student public.students%rowtype;
  v_attempt_id uuid;
  v_seed text;
  v_attempt_limit int;
  v_clean_name text;
  v_clean_norm text;
BEGIN
  select * into v_exam from public.exams e where e.id = p_exam_id;
  if not found then
    raise exception 'exam_not_found';
  end if;

  if v_exam.status <> 'published' then
    raise exception 'exam_not_published';
  end if;

  if v_exam.start_time is not null and now() < v_exam.start_time then
    raise exception 'exam_not_started';
  end if;
  if v_exam.end_time is not null and now() > v_exam.end_time then
    raise exception 'exam_ended';
  end if;

  v_attempt_limit := coalesce((v_exam.settings->>'attempt_limit')::int, 1);

  if v_exam.access_type = 'code_based' then
    if p_code is null then
      raise exception 'code_required';
    end if;
    select * into v_student from public.students s where s.code = p_code;
    if not found then
      raise exception 'invalid_code';
    end if;
    -- Lock on (exam_id, student_id) to avoid race conditions starting multiple attempts
    PERFORM pg_advisory_xact_lock(hashtext(p_exam_id::text), hashtext(v_student.id::text));
    -- Ensure no prior attempt exists for this student in this exam
    if exists (
      select 1 from public.student_exam_attempts sea
      where sea.exam_id = p_exam_id and sea.student_id = v_student.id
    ) then
      raise exception 'code_already_used';
    end if;
  end if;

  -- Prepare student name for ip/open modes (kept for storage/UX)
  if v_exam.access_type = 'ip_restricted' then
    v_clean_name := nullif(btrim(p_student_name), '');
    if v_clean_name is null then
      raise exception 'student_name_required';
    end if;
  elsif v_exam.access_type = 'open' then
    v_clean_name := nullif(btrim(p_student_name), '');
  end if;

  -- Attempt limiting
  -- code_based: no IP-based limiting (each code limited via student_exam_attempts)
  -- ip_restricted/open: enforce per-IP-per-exam using attempt_limit from settings
  if v_attempt_limit > 0 then
    if v_exam.access_type in ('ip_restricted','open') then
      -- Lock on (exam_id, ip) to avoid races
      PERFORM pg_advisory_xact_lock(hashtext(p_exam_id::text), hashtext(host(p_ip)));
      if (
        select count(*) 
        from public.exam_attempts a 
        where a.exam_id = p_exam_id and a.ip_address = p_ip
      ) >= v_attempt_limit then
        raise exception 'attempt_limit_reached';
      end if;
    end if;
  end if;

  -- IP rules
  if exists (select 1 from public.exam_ips ip where ip.exam_id = p_exam_id and ip.rule_type='whitelist') then
    if not exists (select 1 from public.exam_ips ip where ip.exam_id = p_exam_id and ip.rule_type='whitelist' and p_ip << ip.ip_range) then
      raise exception 'ip_not_whitelisted';
    end if;
  end if;
  if exists (select 1 from public.exam_ips ip where ip.exam_id = p_exam_id and ip.rule_type='blacklist' and p_ip << ip.ip_range) then
    raise exception 'ip_blacklisted';
  end if;

  v_seed := encode(gen_random_bytes(16), 'hex');
  v_attempt_id := gen_random_uuid();

  insert into public.exam_attempts(id, exam_id, student_id, ip_address, student_name, answers, auto_save_data, completion_status, version)
  values(
    v_attempt_id,
    p_exam_id,
    case when v_exam.access_type='code_based' then v_student.id else null end,
    p_ip,
    case when v_exam.access_type in ('ip_restricted','open') then v_clean_name else null end,
    '{}'::jsonb,
    jsonb_build_object('seed', v_seed, 'progress', jsonb_build_object('answered',0,'total',0)),
    'in_progress',
    1
  );

  if v_exam.access_type='code_based' then
    insert into public.student_exam_attempts(student_id, exam_id, attempt_id, status)
    values (v_student.id, p_exam_id, v_attempt_id, 'in_progress');
  end if;

  return query select v_attempt_id, v_seed;
END;
$function$;

-- Compatibility wrapper: start_attempt_v2 delegates to start_attempt
-- Ensures API calling start_attempt_v2 uses the same per-exam attempt limiting and IP rules
CREATE OR REPLACE FUNCTION public.start_attempt_v2(p_exam_id uuid, p_code text, p_student_name text, p_ip inet)
 RETURNS TABLE(attempt_id uuid, seed text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
BEGIN
  -- Delegate to the primary implementation
  RETURN QUERY SELECT * FROM public.start_attempt(p_exam_id, p_code, p_student_name, p_ip);
END;
$function$;

-- submit_attempt(uuid) -> table(total_questions int, correct_count int, score_percentage numeric)
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

  RETURN QUERY SELECT v_total, v_correct, v_score;
END;
$function$;

-- cleanup_expired_attempts() -> auto-submit expired in-progress attempts
CREATE OR REPLACE FUNCTION public.cleanup_expired_attempts()
 RETURNS TABLE(auto_submitted_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
DECLARE
  v_id uuid;
  v_count integer := 0;
BEGIN
  -- Iterate over all attempts that have expired by duration or exam end_time
  FOR v_id IN
    SELECT a.id
    FROM public.exam_attempts a
    JOIN public.exams e ON e.id = a.exam_id
    WHERE a.submitted_at IS NULL
      AND a.completion_status = 'in_progress'
      AND (
        (e.duration_minutes IS NOT NULL AND now() >= a.started_at + make_interval(mins => e.duration_minutes))
        OR (e.end_time IS NOT NULL AND now() >= e.end_time)
      )
  LOOP
    BEGIN
      -- Use existing grading + submission logic
      PERFORM * FROM public.submit_attempt(v_id);
      v_count := v_count + 1;

      -- Update per-exam tracking if present
      UPDATE public.student_exam_attempts
        SET completed_at = now(), status = 'completed'
        WHERE attempt_id = v_id AND completed_at IS NULL;
    EXCEPTION WHEN others THEN
      -- Ignore races (e.g., attempt already submitted) and continue
      CONTINUE;
    END;
  END LOOP;

  RETURN QUERY SELECT v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_attempts(p_exam_id uuid)
RETURNS TABLE (
  id uuid,
  exam_id uuid,
  started_at timestamptz,
  submitted_at timestamptz,
  completion_status text,
  ip_address inet,
  student_name text,
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
         coalesce(s.student_name, a.student_name) as student_name,
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

-- Grants (RPCs are called by anon or service role depending on server config)
grant execute on function public.get_attempt_state(uuid) to anon, authenticated;
grant execute on function public.save_attempt(uuid, jsonb, jsonb, integer) to anon, authenticated;
grant execute on function public.start_attempt(uuid, text, text, inet) to anon, authenticated;
grant execute on function public.start_attempt_v2(uuid, text, text, inet) to anon, authenticated;
grant execute on function public.submit_attempt(uuid) to anon, authenticated;
grant execute on function public.admin_list_attempts(uuid) to service_role;
grant execute on function public.cleanup_expired_attempts() to service_role;

-- Regrade a single attempt (admin only), returns recalculated values
CREATE OR REPLACE FUNCTION public.regrade_attempt(p_attempt_id uuid)
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
  v_old_score numeric;
  v_old_final numeric;
  v_res record;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT er.score_percentage, COALESCE(er.final_score_percentage, er.score_percentage)
  INTO v_old_score, v_old_final
  FROM public.exam_results er
  WHERE er.attempt_id = p_attempt_id;

  SELECT * INTO v_res FROM public.calculate_result_for_attempt(p_attempt_id);

  INSERT INTO public.exam_results_history(
    attempt_id, old_score_percentage, new_score_percentage,
    old_final_score_percentage, new_final_score_percentage, meta, changed_at
  )
  VALUES (
    p_attempt_id, v_old_score, v_res.score_percentage,
    v_old_final, v_res.final_score_percentage, '{}'::jsonb, now()
  );

  RETURN QUERY SELECT v_res.total_questions, v_res.correct_count, v_res.score_percentage, v_res.auto_points, v_res.manual_points, v_res.max_points, v_res.final_score_percentage;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.regrade_attempt(uuid) TO service_role;

-- Regrade all attempts for an exam (admin only)
CREATE OR REPLACE FUNCTION public.regrade_exam(p_exam_id uuid)
RETURNS TABLE(regraded_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_count integer := 0;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  FOR v_id IN SELECT id FROM public.exam_attempts WHERE exam_id = p_exam_id LOOP
    PERFORM * FROM public.regrade_attempt(v_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.regrade_exam(uuid) TO service_role;

-- Hard-delete a student and all their attempts/results/grades/activities (admin only)
CREATE OR REPLACE FUNCTION public.admin_delete_student_and_attempts(p_student_id uuid)
RETURNS TABLE(deleted_attempts integer, deleted_student boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_deleted_attempts integer := 0;
  v_deleted_student boolean := false;
  v_deleted_student_i integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_student_id IS NULL THEN
    RAISE EXCEPTION 'invalid_student_id';
  END IF;

  -- Collect attempt IDs linked to this student
  WITH all_attempts AS (
    SELECT id AS attempt_id FROM public.exam_attempts WHERE student_id = p_student_id
    UNION
    SELECT attempt_id FROM public.student_exam_attempts WHERE student_id = p_student_id AND attempt_id IS NOT NULL
  )
  DELETE FROM public.exam_attempts ea
  USING all_attempts a
  WHERE ea.id = a.attempt_id;
  GET DIAGNOSTICS v_deleted_attempts = ROW_COUNT;

  -- Clean join rows and extra scores
  DELETE FROM public.student_exam_attempts WHERE student_id = p_student_id;
  DELETE FROM public.extra_scores WHERE student_id = p_student_id;

  -- Finally delete the student
  DELETE FROM public.students WHERE id = p_student_id;
  GET DIAGNOSTICS v_deleted_student_i = ROW_COUNT;
  v_deleted_student := v_deleted_student_i > 0;

  RETURN QUERY SELECT v_deleted_attempts, v_deleted_student;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_delete_student_and_attempts(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_student_and_attempts(uuid) TO anon, authenticated;

-- Clear all students (admin only); preserves historical exam data (attempts remain, student_id set null)
CREATE OR REPLACE FUNCTION public.clear_all_students()
RETURNS TABLE(
  deleted_count integer,
  attempts_deleted integer,
  links_deleted integer,
  extra_scores_deleted integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_deleted integer := 0; -- students
  v_attempts integer := 0;
  v_links integer := 0;
  v_extra integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Delete attempts first (cascades will clean results, grades, activities)
  DELETE FROM public.exam_attempts WHERE true;
  GET DIAGNOSTICS v_attempts = ROW_COUNT;

  -- Clear join rows and extra scores
  DELETE FROM public.student_exam_attempts WHERE true;
  GET DIAGNOSTICS v_links = ROW_COUNT;

  DELETE FROM public.extra_scores WHERE true;
  GET DIAGNOSTICS v_extra = ROW_COUNT;

  -- Finally delete students
  DELETE FROM public.students WHERE true;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN QUERY SELECT v_deleted, v_attempts, v_links, v_extra;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.clear_all_students() TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_all_students() TO anon, authenticated;

-- Remove an extra score key from all students and delete its field definition (admin only)
CREATE OR REPLACE FUNCTION public.admin_extra_scores_remove_key(p_key text)
RETURNS TABLE(updated_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_key IS NULL OR btrim(p_key) = '' THEN
    RAISE EXCEPTION 'invalid_key';
  END IF;

  UPDATE public.extra_scores SET data = COALESCE(data, '{}'::jsonb) - p_key;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  DELETE FROM public.extra_score_fields WHERE key = p_key;

  RETURN QUERY SELECT v_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_extra_scores_remove_key(text) TO service_role;

-- Admin management RPCs
-- Reset a student's attempts (admin only). This deletes rows from student_exam_attempts
-- so the student can retake exams. Historical exam_attempts and exam_results remain.
CREATE OR REPLACE FUNCTION public.admin_reset_student_attempts(p_student_id uuid, p_exam_id uuid DEFAULT NULL)
 RETURNS TABLE(deleted_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
DECLARE
  v_deleted integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_student_id IS NULL THEN
    RAISE EXCEPTION 'invalid_student_id';
  END IF;

  IF p_exam_id IS NULL THEN
    DELETE FROM public.student_exam_attempts
    WHERE student_id = p_student_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  ELSE
    DELETE FROM public.student_exam_attempts
    WHERE student_id = p_student_id AND exam_id = p_exam_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  END IF;

  RETURN QUERY SELECT v_deleted;
END;
$function$;

grant execute on function public.admin_reset_student_attempts(uuid, uuid) to service_role;
grant execute on function public.admin_reset_student_attempts(uuid, uuid) to anon, authenticated;

-- List admins (requires caller to be admin)
CREATE OR REPLACE FUNCTION public.admin_list_admins()
 RETURNS TABLE(user_id uuid, username text, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
    SELECT au.user_id, u.username, au.email
    FROM public.admin_users au
    LEFT JOIN public.users u ON u.id = au.user_id
    ORDER BY coalesce(u.username, '') ASC, au.email NULLS LAST, au.user_id;
END;
$function$;

-- Add admin by email (requires caller to be admin). Finds the user in auth.users by email.
CREATE OR REPLACE FUNCTION public.admin_add_admin_by_email(p_email text)
 RETURNS TABLE(user_id uuid, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
DECLARE
  v_uid uuid;
  v_email text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_email := lower(trim(p_email));
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  -- Find or create a user by email in public.users
  SELECT u.id INTO v_uid
  FROM public.users u
  WHERE lower(u.email) = v_email
  LIMIT 1;

  IF v_uid IS NULL THEN
    INSERT INTO public.users(email) VALUES (v_email)
    ON CONFLICT (email) DO NOTHING;
    SELECT u.id INTO v_uid FROM public.users u WHERE lower(u.email) = v_email LIMIT 1;
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'user_create_failed';
  END IF;

  -- Explicitly check if admin exists to avoid ambiguous column reference with RLS
  IF EXISTS(SELECT 1 FROM public.admin_users WHERE admin_users.user_id = v_uid) THEN
    UPDATE public.admin_users 
    SET email = v_email 
    WHERE admin_users.user_id = v_uid;
  ELSE
    INSERT INTO public.admin_users (user_id, email)
    VALUES (v_uid, v_email);
  END IF;

  RETURN QUERY SELECT v_uid, v_email;
END;
$function$;

-- Update an admin's email (requires caller to be admin)
CREATE OR REPLACE FUNCTION public.admin_update_admin_email(p_user_id uuid, p_email text)
 RETURNS TABLE(user_id uuid, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
DECLARE
  v_email text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_email := lower(trim(p_email));
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  UPDATE public.admin_users SET email = v_email WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin_not_found';
  END IF;

  -- Ensure a users row exists with this email (no-op if exists)
  INSERT INTO public.users (email)
  VALUES (v_email)
  ON CONFLICT (email) DO NOTHING;

  RETURN QUERY SELECT p_user_id, v_email;
END;
$function$;

-- Remove admin by user_id (requires caller to be admin)
CREATE OR REPLACE FUNCTION public.admin_remove_admin(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Prevent removing the last remaining admin
  IF (SELECT count(*) FROM public.admin_users) <= 1 THEN
    RAISE EXCEPTION 'cannot_remove_last_admin';
  END IF;

  DELETE FROM public.admin_users WHERE user_id = p_user_id;
END;
$function$;

-- Grants for admin management RPCs
-- Allow authenticated users to call these (the functions have is_admin() checks inside)
grant execute on function public.admin_list_admins() to anon, authenticated, service_role;
grant execute on function public.admin_add_admin_by_email(text) to anon, authenticated, service_role;
grant execute on function public.admin_update_admin_email(uuid, text) to anon, authenticated, service_role;
grant execute on function public.admin_remove_admin(uuid) to anon, authenticated, service_role;

-- Custom auth: login against public.users (username or email) using pgcrypto's crypt
CREATE OR REPLACE FUNCTION public.auth_login(p_identifier text, p_password text)
 RETURNS TABLE(user_id uuid, email text, username text, is_admin boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  SELECT * INTO v_user
  FROM public.users u
  WHERE (u.email IS NOT NULL AND lower(u.email) = lower(p_identifier))
     OR (u.username IS NOT NULL AND lower(u.username) = lower(p_identifier))
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_credentials';
  END IF;

  IF v_user.password_hash IS NULL OR v_user.password_hash = '' OR v_user.password_hash <> crypt(p_password, v_user.password_hash) THEN
    RAISE EXCEPTION 'invalid_credentials';
  END IF;

  RETURN QUERY
  SELECT v_user.id, v_user.email, v_user.username,
         EXISTS(SELECT 1 FROM public.admin_users au WHERE au.user_id = v_user.id);
END;
$function$;

-- Allow anonymous and authenticated users to call login function
grant execute on function public.auth_login(text, text) to anon, authenticated, service_role;

-- Create users with hashed passwords (admin only)
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_username text,
  p_email text,
  p_password text,
  p_is_admin boolean DEFAULT false
)
RETURNS TABLE(user_id uuid, username text, email text, is_admin boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_uid uuid;
  v_username text;
  v_email text;
  v_hash text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_username := nullif(trim(p_username), '');
  v_email := nullif(lower(trim(p_email)), '');

  IF v_username IS NULL AND v_email IS NULL THEN
    RAISE EXCEPTION 'missing_identifier';
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'weak_password';
  END IF;

  -- enforce uniqueness manually to provide clearer errors
  IF v_username IS NOT NULL AND EXISTS(SELECT 1 FROM public.users u WHERE lower(u.username) = lower(v_username)) THEN
    RAISE EXCEPTION 'duplicate_username';
  END IF;
  IF v_email IS NOT NULL AND EXISTS(SELECT 1 FROM public.users u WHERE lower(u.email) = v_email) THEN
    RAISE EXCEPTION 'duplicate_email';
  END IF;

  v_hash := crypt(p_password, gen_salt('bf'));

  INSERT INTO public.users (username, email, password_hash)
  VALUES (v_username, v_email, v_hash)
  RETURNING id INTO v_uid;

  IF p_is_admin THEN
    -- Explicitly check if admin exists to avoid ambiguous column reference with RLS
    IF EXISTS(SELECT 1 FROM public.admin_users WHERE admin_users.user_id = v_uid) THEN
      UPDATE public.admin_users 
      SET email = v_email 
      WHERE admin_users.user_id = v_uid;
    ELSE
      INSERT INTO public.admin_users (user_id, email)
      VALUES (v_uid, v_email);
    END IF;
  END IF;

  RETURN QUERY SELECT v_uid, v_username, v_email, p_is_admin;
END;
$function$;

-- Update a user's password (admin only)
CREATE OR REPLACE FUNCTION public.admin_set_user_password(p_user_id uuid, p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'weak_password';
  END IF;
  UPDATE public.users
    SET password_hash = crypt(p_password, gen_salt('bf'))
    WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;
END;
$function$;

-- Grants
-- Allow authenticated users to call these (the functions have is_admin() checks inside)
grant execute on function public.admin_create_user(text, text, text, boolean) to anon, authenticated, service_role;
grant execute on function public.admin_set_user_password(uuid, text) to anon, authenticated, service_role;

-- Auto-refresh exam_results when manual grades change
CREATE OR REPLACE FUNCTION public.tg_refresh_result_on_manual_grade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_attempt uuid;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_attempt := OLD.attempt_id;
  ELSE
    v_attempt := NEW.attempt_id;
  END IF;

  BEGIN
    PERFORM * FROM public.calculate_result_for_attempt(v_attempt);
  EXCEPTION WHEN OTHERS THEN
    -- Avoid blocking writes if result refresh fails; log via RAISE NOTICE
    RAISE NOTICE 'Result refresh failed for attempt %: %', v_attempt, SQLERRM;
  END;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

DROP TRIGGER IF EXISTS trg_manual_grades_refresh ON public.manual_grades;
CREATE TRIGGER trg_manual_grades_refresh
AFTER INSERT OR UPDATE OR DELETE ON public.manual_grades
FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_result_on_manual_grade();
