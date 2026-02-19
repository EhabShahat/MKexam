-- Fix for start_attempt to use computed status instead of stored status
-- This ensures auto-scheduled exams work correctly

-- Update start_attempt function to check computed accessibility
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
  v_is_accessible boolean;
BEGIN
  select * into v_exam from public.exams e where e.id = p_exam_id;
  if not found then
    raise exception 'exam_not_found';
  end if;

  -- Check if exam is archived (always blocks access)
  if v_exam.is_archived then
    raise exception 'exam_not_published';
  end if;

  -- Compute accessibility based on scheduling mode and time
  -- This replaces the old "if v_exam.status <> 'published'" check
  IF v_exam.scheduling_mode = 'Manual' THEN
    -- Manual mode: admin controls via is_manually_published flag
    v_is_accessible := v_exam.is_manually_published;
  ELSIF v_exam.scheduling_mode = 'Auto' THEN
    -- Auto mode: time-based with optional early publish override
    IF v_exam.is_manually_published AND NOW() < COALESCE(v_exam.end_time, NOW() + interval '1 year') THEN
      -- Early publish override (published before start_time)
      v_is_accessible := true;
    ELSIF NOW() >= COALESCE(v_exam.start_time, NOW()) AND NOW() < COALESCE(v_exam.end_time, NOW() + interval '1 year') THEN
      -- Standard time-based access (between start_time and end_time)
      v_is_accessible := true;
    ELSE
      -- Outside the time window
      v_is_accessible := false;
    END IF;
  ELSE
    -- Fallback for unknown scheduling mode
    v_is_accessible := (v_exam.status = 'published');
  END IF;

  -- Block access if not accessible
  IF NOT v_is_accessible THEN
    raise exception 'exam_not_published';
  END IF;

  -- Legacy time checks (kept for additional validation in Auto mode)
  if v_exam.scheduling_mode = 'Auto' then
    if v_exam.start_time is not null and now() < v_exam.start_time and not v_exam.is_manually_published then
      raise exception 'exam_not_started';
    end if;
    if v_exam.end_time is not null and now() > v_exam.end_time then
      raise exception 'exam_ended';
    end if;
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

-- Update start_attempt_v2 wrapper (it delegates to start_attempt, so it's automatically fixed)
-- But let's ensure it exists and is up to date
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

-- Grant permissions
grant execute on function public.start_attempt(uuid, text, text, inet) to anon, authenticated;
grant execute on function public.start_attempt_v2(uuid, text, text, inet) to anon, authenticated;
