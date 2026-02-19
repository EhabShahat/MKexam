-- Security hardening and policies - Updated from Supabase 2025-01-29
-- This file contains all RLS policies from the live database

-- Enable RLS on all tables (idempotent)
ALTER TABLE IF EXISTS public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.manual_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_results_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_bypass_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blocked_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.extra_score_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.extra_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_public_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Define/replace is_admin() used across RLS and RPCs
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO public, extensions
AS $$
DECLARE
  v_claims json;
  v_email text;
  v_sub_uuid uuid;
BEGIN
  BEGIN
    v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::json;
  EXCEPTION WHEN others THEN
    v_claims := '{}'::json;
  END;
  v_email := lower(coalesce(v_claims->>'email',''));
  BEGIN
    v_sub_uuid := nullif(coalesce(v_claims->>'sub',''), '')::uuid;
  EXCEPTION WHEN others THEN
    v_sub_uuid := null;
  END;

  -- Trust server-side calls using the Supabase service role
  IF current_user = 'service_role' OR lower(coalesce(v_claims->>'role','')) = 'service_role' THEN
    RETURN true;
  END IF;

  -- Otherwise, require that the JWT claims map to an admin in our table
  RETURN EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE (v_sub_uuid IS NOT NULL AND au.user_id = v_sub_uuid)
       OR (coalesce(v_email, '') <> '' AND lower(au.email) = v_email)
  );
END;
$$;

-- ============================================================================
-- ADMIN POLICIES - All tables with admin access
-- ============================================================================

-- admin_users
DROP POLICY IF EXISTS admin_users_admin_all ON public.admin_users;
CREATE POLICY admin_users_admin_all ON public.admin_users
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- app_config
DROP POLICY IF EXISTS app_config_admin_all ON public.app_config;
CREATE POLICY app_config_admin_all ON public.app_config
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- app_settings
DROP POLICY IF EXISTS app_settings_admin_all ON public.app_settings;
DROP POLICY IF EXISTS app_settings_admin_read ON public.app_settings;
CREATE POLICY app_settings_admin_all ON public.app_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- attendance_records
DROP POLICY IF EXISTS attendance_records_admin_all ON public.attendance_records;
CREATE POLICY attendance_records_admin_all ON public.attendance_records
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- audit_logs
DROP POLICY IF EXISTS audit_logs_admin_all ON public.audit_logs;
CREATE POLICY audit_logs_admin_all ON public.audit_logs
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- blocked_entries
DROP POLICY IF EXISTS "Admin can manage blocked entries" ON public.blocked_entries;
CREATE POLICY "Admin can manage blocked entries" ON public.blocked_entries
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- exam_attempts
DROP POLICY IF EXISTS exam_attempts_admin_all ON public.exam_attempts;
CREATE POLICY exam_attempts_admin_all ON public.exam_attempts
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- exam_bypass_codes
DROP POLICY IF EXISTS "Admin can manage exam bypass codes" ON public.exam_bypass_codes;
CREATE POLICY "Admin can manage exam bypass codes" ON public.exam_bypass_codes
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- exam_ips
DROP POLICY IF EXISTS exam_ips_admin_all ON public.exam_ips;
CREATE POLICY exam_ips_admin_all ON public.exam_ips
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- exam_public_config
DROP POLICY IF EXISTS exam_public_config_admin_all ON public.exam_public_config;
CREATE POLICY exam_public_config_admin_all ON public.exam_public_config
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- exam_results
DROP POLICY IF EXISTS exam_results_admin_all ON public.exam_results;
CREATE POLICY exam_results_admin_all ON public.exam_results
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- exam_results_history
DROP POLICY IF EXISTS exam_results_history_admin_all ON public.exam_results_history;
CREATE POLICY exam_results_history_admin_all ON public.exam_results_history
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- exams
DROP POLICY IF EXISTS exams_admin_all ON public.exams;
CREATE POLICY exams_admin_all ON public.exams
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- extra_score_fields
DROP POLICY IF EXISTS extra_score_fields_admin_all ON public.extra_score_fields;
CREATE POLICY extra_score_fields_admin_all ON public.extra_score_fields
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- extra_scores
DROP POLICY IF EXISTS extra_scores_admin_all ON public.extra_scores;
CREATE POLICY extra_scores_admin_all ON public.extra_scores
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- manual_grades
DROP POLICY IF EXISTS manual_grades_admin_all ON public.manual_grades;
CREATE POLICY manual_grades_admin_all ON public.manual_grades
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- questions
DROP POLICY IF EXISTS questions_admin_all ON public.questions;
CREATE POLICY questions_admin_all ON public.questions
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- student_exam_attempts
DROP POLICY IF EXISTS student_exam_attempts_admin_all ON public.student_exam_attempts;
CREATE POLICY student_exam_attempts_admin_all ON public.student_exam_attempts
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- students
DROP POLICY IF EXISTS students_admin_all ON public.students;
CREATE POLICY students_admin_all ON public.students
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- users
DROP POLICY IF EXISTS users_admin_all ON public.users;
CREATE POLICY users_admin_all ON public.users
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================================
-- PUBLIC/ANON POLICIES - Controlled public access
-- ============================================================================

-- app_config: Public can read specific system configuration keys
DROP POLICY IF EXISTS app_config_public_read_keys ON public.app_config;
CREATE POLICY app_config_public_read_keys ON public.app_config
  FOR SELECT TO anon
  USING (key IN ('system_mode','system_disabled','system_disabled_message'));

-- app_settings: Public can read (for branding, etc.)
DROP POLICY IF EXISTS app_settings_public_read ON public.app_settings;
CREATE POLICY app_settings_public_read ON public.app_settings
  FOR SELECT USING (true);

-- exam_attempts: Readable publicly only if they have results and belong to a published exam
DROP POLICY IF EXISTS exam_attempts_public_results_read ON public.exam_attempts;
CREATE POLICY exam_attempts_public_results_read ON public.exam_attempts
  FOR SELECT TO anon
  USING (
    EXISTS (SELECT 1 FROM public.exam_results er WHERE er.attempt_id = exam_attempts.id)
    AND EXISTS (
      SELECT 1 FROM public.exams ex
      WHERE ex.id = exam_attempts.exam_id AND ex.status = 'published'
    )
  );

-- exam_public_config: Public can read config for published exams
DROP POLICY IF EXISTS exam_public_config_public_read ON public.exam_public_config;
CREATE POLICY exam_public_config_public_read ON public.exam_public_config
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.exams ex
      WHERE ex.id = exam_public_config.exam_id AND ex.status = 'published'
    )
  );

-- exam_results: Readable publicly only when the related exam is published
DROP POLICY IF EXISTS exam_results_public_read ON public.exam_results;
CREATE POLICY exam_results_public_read ON public.exam_results
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.exam_attempts ea
      JOIN public.exams ex ON ex.id = ea.exam_id
      WHERE ea.id = exam_results.attempt_id AND ex.status = 'published'
    )
  );

-- exams: Visible to public only when published
DROP POLICY IF EXISTS exams_public_read_published ON public.exams;
CREATE POLICY exams_public_read_published ON public.exams
  FOR SELECT TO anon
  USING (status = 'published');

-- student_exam_attempts: Readable publicly only for published, code-based exams
DROP POLICY IF EXISTS student_exam_attempts_public_read ON public.student_exam_attempts;
CREATE POLICY student_exam_attempts_public_read ON public.student_exam_attempts
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.exams ex
      WHERE ex.id = student_exam_attempts.exam_id
        AND ex.status = 'published'
        AND ex.access_type = 'code_based'
    )
  );

-- student_requests: Authenticated users can read and update (admin interface)
DROP POLICY IF EXISTS "Allow admins to read requests" ON public.student_requests;
CREATE POLICY "Allow admins to read requests" ON public.student_requests
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admins to update requests" ON public.student_requests;
CREATE POLICY "Allow admins to update requests" ON public.student_requests
  FOR UPDATE TO authenticated
  USING (true);

-- student_requests: Public can insert (registration form)
DROP POLICY IF EXISTS "Allow public insert for registration requests" ON public.student_requests;
CREATE POLICY "Allow public insert for registration requests" ON public.student_requests
  FOR INSERT
  WITH CHECK (true);

-- students: Readable for public results search and code-based flows
DROP POLICY IF EXISTS students_public_read ON public.students;
CREATE POLICY students_public_read ON public.students
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.exam_attempts ea
      JOIN public.exam_results er ON er.attempt_id = ea.id
      JOIN public.exams ex ON ex.id = ea.exam_id
      WHERE ea.student_id = students.id AND ex.status = 'published'
    )
    OR EXISTS (
      SELECT 1
      FROM public.student_exam_attempts sea
      JOIN public.exams ex2 ON ex2.id = sea.exam_id
      WHERE sea.student_id = students.id AND ex2.status = 'published' AND ex2.access_type = 'code_based'
    )
  );

-- ============================================================================
-- VIEWS - Recreate with extended fields
-- ============================================================================

CREATE OR REPLACE VIEW public.student_exam_summary WITH (security_invoker = true) AS
  SELECT
    s.id AS student_id,
    s.code,
    s.student_name,
    s.mobile_number,
    s.mobile_number2,
    s.address,
    s.national_id,
    s.photo_url,
    s.national_id_photo_url,
    COUNT(sea.id) AS total_exams_attempted,
    COUNT(CASE WHEN sea.status = 'completed' THEN 1 END) AS completed_exams,
    COUNT(CASE WHEN sea.status = 'in_progress' THEN 1 END) AS in_progress_exams,
    s.created_at AS student_created_at,
    s.updated_at AS student_updated_at
  FROM public.students s
  LEFT JOIN public.student_exam_attempts sea ON sea.student_id = s.id
  GROUP BY s.id, s.code, s.student_name, s.mobile_number, s.mobile_number2, 
           s.address, s.national_id, s.photo_url, s.national_id_photo_url, 
           s.created_at, s.updated_at;

-- ============================================================================
-- FUNCTION SECURITY - Set immutable search_path for all functions
-- ============================================================================

DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, oidvectortypes(p.proargtypes) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path TO public, extensions, pg_temp', 
                   r.nspname, r.proname, r.args);
  END LOOP;
END $do$;
