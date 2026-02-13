-- Score Calculation Views and Optimization
-- This file contains materialized views, cache tables, indexes, and triggers
-- for optimizing score calculation performance
-- Safe and idempotent

-- ============================================================================
-- MATERIALIZED VIEW: student_score_summary
-- ============================================================================
-- Aggregates student data with exam attempts and extra scores for efficient
-- score calculation. This view is refreshed automatically when data changes.

-- Drop existing view if it exists (to allow schema changes)
drop materialized view if exists public.student_score_summary cascade;

create materialized view public.student_score_summary as
select 
  s.id as student_id,
  s.code as student_code,
  s.student_name,
  
  -- Aggregate exam attempts with results
  -- Only include submitted attempts for exams with status 'done'
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'exam_id', e.id,
        'exam_title', e.title,
        'exam_type', e.exam_type,
        'score_percentage', er.score_percentage,
        'final_score_percentage', er.final_score_percentage,
        'submitted_at', ea.submitted_at,
        'include_in_pass', coalesce(epc.include_in_pass, true),
        'pass_threshold', (e.settings->>'pass_percentage')::numeric
      ) order by ea.submitted_at desc
    ) filter (where e.id is not null),
    '[]'::jsonb
  ) as exam_attempts,
  
  -- Extra scores data
  coalesce(es.data, '{}'::jsonb) as extra_scores,
  
  -- Metadata for tracking
  max(ea.submitted_at) as last_attempt_date,
  count(distinct e.id) filter (where e.status = 'done') as exams_taken,
  s.created_at as student_created_at,
  s.updated_at as student_updated_at
  
from public.students s
left join public.exam_attempts ea on ea.student_id = s.id 
  and ea.completion_status = 'submitted'
left join public.exams e on e.id = ea.exam_id 
  and e.status = 'done'
left join public.exam_public_config epc on epc.exam_id = e.id
left join public.exam_results er on er.attempt_id = ea.id
left join public.extra_scores es on es.student_id = s.id
group by s.id, s.code, s.student_name, es.data, s.created_at, s.updated_at;

-- Create indexes on the materialized view for fast lookups
create unique index idx_student_score_summary_student_id 
  on public.student_score_summary(student_id);

create index idx_student_score_summary_code 
  on public.student_score_summary(student_code);

create index idx_student_score_summary_last_attempt 
  on public.student_score_summary(last_attempt_date desc nulls last);

-- ============================================================================
-- CACHE TABLE: score_calculation_cache
-- ============================================================================
-- Stores calculated scores with expiration for performance optimization

create table if not exists public.score_calculation_cache (
  student_code text primary key,
  calculation_result jsonb not null,
  settings_hash text not null,
  calculated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes')
);

-- Index for efficient cleanup of expired entries
create index if not exists idx_score_cache_expires 
  on public.score_calculation_cache(expires_at);

-- Index for settings-based lookups
create index if not exists idx_score_cache_settings_hash 
  on public.score_calculation_cache(settings_hash);

-- ============================================================================
-- CACHE CLEANUP FUNCTION
-- ============================================================================
-- Removes expired cache entries to prevent table bloat

create or replace function public.cleanup_expired_score_cache()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.score_calculation_cache 
  where expires_at < now();
end;
$$;

-- ============================================================================
-- MATERIALIZED VIEW REFRESH FUNCTION
-- ============================================================================
-- Refreshes the student_score_summary materialized view
-- Uses CONCURRENTLY to avoid locking the view during refresh

create or replace function public.refresh_student_score_summary()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Refresh concurrently to avoid blocking reads
  -- Requires unique index (created above)
  refresh materialized view concurrently public.student_score_summary;
  return null;
end;
$$;

-- ============================================================================
-- CACHE INVALIDATION FUNCTION
-- ============================================================================
-- Invalidates cache entries for affected students when data changes

create or replace function public.invalidate_score_cache_for_student()
returns trigger
language plpgsql
security definer
as $$
declare
  affected_code text;
begin
  -- Determine which student code(s) are affected
  if TG_TABLE_NAME = 'exam_results' then
    -- Get student code from exam_attempts
    select s.code into affected_code
    from public.exam_attempts ea
    join public.students s on s.id = ea.student_id
    where ea.id = coalesce(NEW.attempt_id, OLD.attempt_id);
    
  elsif TG_TABLE_NAME = 'extra_scores' then
    -- Get student code directly
    select s.code into affected_code
    from public.students s
    where s.id = coalesce(NEW.student_id, OLD.student_id);
    
  elsif TG_TABLE_NAME = 'exam_attempts' then
    -- Get student code from the attempt
    select s.code into affected_code
    from public.students s
    where s.id = coalesce(NEW.student_id, OLD.student_id);
  end if;
  
  -- Delete cache entry if found
  if affected_code is not null then
    delete from public.score_calculation_cache 
    where student_code = affected_code;
  end if;
  
  return coalesce(NEW, OLD);
end;
$$;

-- ============================================================================
-- TRIGGERS FOR MATERIALIZED VIEW REFRESH
-- ============================================================================
-- Automatically refresh the materialized view when relevant data changes

-- Trigger on exam_results changes
drop trigger if exists refresh_scores_on_exam_result on public.exam_results;
create trigger refresh_scores_on_exam_result
  after insert or update or delete on public.exam_results
  for each statement
  execute function public.refresh_student_score_summary();

-- Trigger on extra_scores changes
drop trigger if exists refresh_scores_on_extra_scores on public.extra_scores;
create trigger refresh_scores_on_extra_scores
  after insert or update or delete on public.extra_scores
  for each statement
  execute function public.refresh_student_score_summary();

-- Trigger on exam_attempts changes (for completion status)
drop trigger if exists refresh_scores_on_exam_attempts on public.exam_attempts;
create trigger refresh_scores_on_exam_attempts
  after insert or update of completion_status, submitted_at on public.exam_attempts
  for each statement
  execute function public.refresh_student_score_summary();

-- Trigger on exams changes (for status changes)
drop trigger if exists refresh_scores_on_exams on public.exams;
create trigger refresh_scores_on_exams
  after update of status, settings on public.exams
  for each statement
  execute function public.refresh_student_score_summary();

-- ============================================================================
-- TRIGGERS FOR CACHE INVALIDATION
-- ============================================================================
-- Automatically invalidate cache when student data changes

-- Trigger on exam_results changes
drop trigger if exists invalidate_cache_on_exam_result on public.exam_results;
create trigger invalidate_cache_on_exam_result
  after insert or update or delete on public.exam_results
  for each row
  execute function public.invalidate_score_cache_for_student();

-- Trigger on extra_scores changes
drop trigger if exists invalidate_cache_on_extra_scores on public.extra_scores;
create trigger invalidate_cache_on_extra_scores
  after insert or update or delete on public.extra_scores
  for each row
  execute function public.invalidate_score_cache_for_student();

-- Trigger on exam_attempts changes
drop trigger if exists invalidate_cache_on_exam_attempts on public.exam_attempts;
create trigger invalidate_cache_on_exam_attempts
  after update of answers, completion_status on public.exam_attempts
  for each row
  execute function public.invalidate_score_cache_for_student();

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================
-- Additional indexes for optimizing score calculation queries

-- Index on students table for code lookups
create index if not exists idx_students_code 
  on public.students(code);

-- Index on exam_attempts for student and exam lookups
create index if not exists idx_exam_attempts_student_exam 
  on public.exam_attempts(student_id, exam_id, completion_status);

-- Index on exam_results for attempt lookups
create index if not exists idx_exam_results_attempt 
  on public.exam_results(attempt_id);

-- Index on extra_scores for student lookups
create index if not exists idx_extra_scores_student_id 
  on public.extra_scores(student_id);

-- Index on exams for status filtering
create index if not exists idx_exams_status 
  on public.exams(status) where status = 'done';

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

comment on materialized view public.student_score_summary is 
  'Aggregated view of student data with exam attempts and extra scores for efficient score calculation';

comment on table public.score_calculation_cache is 
  'Cache table for storing calculated scores with expiration to improve performance';

comment on function public.refresh_student_score_summary() is 
  'Refreshes the student_score_summary materialized view concurrently';

comment on function public.cleanup_expired_score_cache() is 
  'Removes expired entries from the score calculation cache';

comment on function public.invalidate_score_cache_for_student() is 
  'Invalidates cache entries for students when their data changes';


-- ============================================================================
-- EXTRA SCORES SYNC FUNCTIONS
-- ============================================================================
-- These functions ensure attendance, homework, and quiz scores are calculated
-- correctly from actual data sources (attendance_records and exam_results)
-- ============================================================================

-- Function to calculate attendance percentages for all students
CREATE OR REPLACE FUNCTION sync_all_attendance_percentages()
RETURNS TABLE(
  student_id uuid,
  student_code text,
  attended_sessions bigint,
  total_sessions bigint,
  attendance_percentage numeric
) AS $$
DECLARE
  total_session_count bigint;
BEGIN
  -- Get total number of unique session dates
  SELECT COUNT(DISTINCT session_date) INTO total_session_count
  FROM attendance_records;
  
  -- Return attendance stats for each student
  RETURN QUERY
  SELECT 
    s.id as student_id,
    s.code as student_code,
    COALESCE(COUNT(DISTINCT ar.session_date), 0) as attended_sessions,
    total_session_count as total_sessions,
    CASE 
      WHEN total_session_count > 0 THEN 
        ROUND((COALESCE(COUNT(DISTINCT ar.session_date), 0)::numeric / total_session_count::numeric) * 100)
      ELSE 0
    END as attendance_percentage
  FROM students s
  LEFT JOIN attendance_records ar ON ar.student_id = s.id
  GROUP BY s.id, s.code
  ORDER BY s.code;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate homework and quiz scores for all students
CREATE OR REPLACE FUNCTION sync_homework_and_quiz_scores()
RETURNS TABLE(
  student_id uuid,
  student_code text,
  homework_score numeric,
  quiz_score numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH homework_scores AS (
    SELECT 
      s.id as student_id,
      s.code as student_code,
      ROUND(AVG(COALESCE(er.final_score_percentage, er.score_percentage))) as avg_homework
    FROM students s
    LEFT JOIN exam_attempts ea ON ea.student_id = s.id
    LEFT JOIN exams e ON e.id = ea.exam_id
    LEFT JOIN exam_results er ON er.attempt_id = ea.id
    WHERE e.exam_type = 'homework' 
      AND e.status = 'done'
      AND ea.completion_status = 'submitted'
    GROUP BY s.id, s.code
  ),
  quiz_scores AS (
    SELECT 
      s.id as student_id,
      s.code as student_code,
      ROUND(AVG(COALESCE(er.final_score_percentage, er.score_percentage))) as avg_quiz
    FROM students s
    LEFT JOIN exam_attempts ea ON ea.student_id = s.id
    LEFT JOIN exams e ON e.id = ea.exam_id
    LEFT JOIN exam_results er ON er.attempt_id = ea.id
    WHERE e.exam_type = 'quiz' 
      AND e.status = 'done'
      AND ea.completion_status = 'submitted'
    GROUP BY s.id, s.code
  )
  SELECT 
    s.id as student_id,
    s.code as student_code,
    COALESCE(h.avg_homework, 0) as homework_score,
    COALESCE(q.avg_quiz, 0) as quiz_score
  FROM students s
  LEFT JOIN homework_scores h ON h.student_id = s.id
  LEFT JOIN quiz_scores q ON q.student_id = s.id
  ORDER BY s.code;
END;
$$ LANGUAGE plpgsql;

-- Comprehensive function to sync all extra scores (attendance, homework, quiz)
-- This is the main function that should be called to update all extra scores
CREATE OR REPLACE FUNCTION sync_all_extra_scores()
RETURNS TABLE(
  updated_count bigint,
  message text
) AS $$
DECLARE
  update_count bigint := 0;
BEGIN
  -- Update attendance percentages
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
  
  -- Update homework and quiz scores
  WITH homework_scores AS (
    SELECT 
      s.id as student_id,
      ROUND(AVG(COALESCE(er.final_score_percentage, er.score_percentage))) as avg_homework
    FROM students s
    LEFT JOIN exam_attempts ea ON ea.student_id = s.id
    LEFT JOIN exams e ON e.id = ea.exam_id
    LEFT JOIN exam_results er ON er.attempt_id = ea.id
    WHERE e.exam_type = 'homework' 
      AND e.status = 'done'
      AND ea.completion_status = 'submitted'
    GROUP BY s.id
  ),
  quiz_scores AS (
    SELECT 
      s.id as student_id,
      ROUND(AVG(COALESCE(er.final_score_percentage, er.score_percentage))) as avg_quiz
    FROM students s
    LEFT JOIN exam_attempts ea ON ea.student_id = s.id
    LEFT JOIN exams e ON e.id = ea.exam_id
    LEFT JOIN exam_results er ON er.attempt_id = ea.id
    WHERE e.exam_type = 'quiz' 
      AND e.status = 'done'
      AND ea.completion_status = 'submitted'
    GROUP BY s.id
  ),
  combined_scores AS (
    SELECT 
      s.id as student_id,
      COALESCE(h.avg_homework, 0) as homework_score,
      COALESCE(q.avg_quiz, 0) as quiz_score
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
$$ LANGUAGE plpgsql;

-- Helper function to update a single student's extra scores
-- Useful for real-time updates when a student submits an exam or attendance is recorded
CREATE OR REPLACE FUNCTION sync_student_extra_scores(p_student_id uuid)
RETURNS void AS $$
DECLARE
  v_attendance_percentage numeric;
  v_homework_score numeric;
  v_quiz_score numeric;
  v_total_sessions bigint;
BEGIN
  -- Calculate attendance
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
  
  -- Calculate homework score
  SELECT ROUND(AVG(COALESCE(er.final_score_percentage, er.score_percentage)))
  INTO v_homework_score
  FROM exam_attempts ea
  JOIN exams e ON e.id = ea.exam_id
  JOIN exam_results er ON er.attempt_id = ea.id
  WHERE ea.student_id = p_student_id
    AND e.exam_type = 'homework'
    AND e.status = 'done'
    AND ea.completion_status = 'submitted';
  
  -- Calculate quiz score
  SELECT ROUND(AVG(COALESCE(er.final_score_percentage, er.score_percentage)))
  INTO v_quiz_score
  FROM exam_attempts ea
  JOIN exams e ON e.id = ea.exam_id
  JOIN exam_results er ON er.attempt_id = ea.id
  WHERE ea.student_id = p_student_id
    AND e.exam_type = 'quiz'
    AND e.status = 'done'
    AND ea.completion_status = 'submitted';
  
  -- Update extra_scores
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
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_all_extra_scores() IS 'Syncs attendance, homework, and quiz scores for all students from actual data sources';
COMMENT ON FUNCTION sync_student_extra_scores(uuid) IS 'Syncs extra scores for a single student - useful for real-time updates';
