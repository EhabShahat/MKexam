-- Rollback: 05_rls_optimizations.sql
-- Description: Restore original RLS policies
-- Date: 2026-01-30

-- Note: This rollback script restores the original multiple permissive policies
-- It should only be used if the consolidated policies cause issues

-- ============================================================================
-- RESTORE ORIGINAL POLICIES
-- ============================================================================

-- 1. EXAMS TABLE
DROP POLICY IF EXISTS exams_unified_select ON exams;
DROP POLICY IF EXISTS exams_admin_insert ON exams;
DROP POLICY IF EXISTS exams_admin_update ON exams;
DROP POLICY IF EXISTS exams_admin_delete ON exams;

CREATE POLICY exams_admin_all ON exams FOR ALL USING (is_admin());
CREATE POLICY exams_public_read_published ON exams FOR SELECT USING (status = 'published'::text);

-- 2. EXAM_ATTEMPTS TABLE
DROP POLICY IF EXISTS exam_attempts_unified_select ON exam_attempts;
DROP POLICY IF EXISTS exam_attempts_admin_insert ON exam_attempts;
DROP POLICY IF EXISTS exam_attempts_admin_update ON exam_attempts;
DROP POLICY IF EXISTS exam_attempts_admin_delete ON exam_attempts;

CREATE POLICY exam_attempts_admin_all ON exam_attempts FOR ALL USING (is_admin());
CREATE POLICY exam_attempts_public_results_read ON exam_attempts FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM exam_results er WHERE er.attempt_id = exam_attempts.id)
  AND EXISTS (SELECT 1 FROM exams ex WHERE ex.id = exam_attempts.exam_id AND ex.status = 'published'::text)
);

-- 3. EXAM_RESULTS TABLE
DROP POLICY IF EXISTS exam_results_unified_select ON exam_results;
DROP POLICY IF EXISTS exam_results_admin_insert ON exam_results;
DROP POLICY IF EXISTS exam_results_admin_update ON exam_results;
DROP POLICY IF EXISTS exam_results_admin_delete ON exam_results;

CREATE POLICY exam_results_admin_all ON exam_results FOR ALL USING (is_admin());
CREATE POLICY exam_results_public_read ON exam_results FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM exam_attempts ea
    JOIN exams ex ON ex.id = ea.exam_id
    WHERE ea.id = exam_results.attempt_id AND ex.status = 'published'::text
  )
);

-- 4. STUDENTS TABLE
DROP POLICY IF EXISTS students_unified_select ON students;
DROP POLICY IF EXISTS students_admin_insert ON students;
DROP POLICY IF EXISTS students_admin_update ON students;
DROP POLICY IF EXISTS students_admin_delete ON students;

CREATE POLICY students_admin_all ON students FOR ALL USING (is_admin());
CREATE POLICY students_public_read ON students FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM exam_attempts ea
    JOIN exam_results er ON er.attempt_id = ea.id
    JOIN exams ex ON ex.id = ea.exam_id
    WHERE ea.student_id = students.id AND ex.status = 'published'::text
  )
  OR EXISTS (
    SELECT 1 FROM student_exam_attempts sea
    JOIN exams ex2 ON ex2.id = sea.exam_id
    WHERE sea.student_id = students.id 
      AND ex2.status = 'published'::text 
      AND ex2.access_type = 'code_based'::text
  )
);

-- 5. STUDENT_EXAM_ATTEMPTS TABLE
DROP POLICY IF EXISTS student_exam_attempts_unified_select ON student_exam_attempts;
DROP POLICY IF EXISTS student_exam_attempts_admin_insert ON student_exam_attempts;
DROP POLICY IF EXISTS student_exam_attempts_admin_update ON student_exam_attempts;
DROP POLICY IF EXISTS student_exam_attempts_admin_delete ON student_exam_attempts;

CREATE POLICY student_exam_attempts_admin_all ON student_exam_attempts FOR ALL USING (is_admin());
CREATE POLICY student_exam_attempts_public_read ON student_exam_attempts FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM exams ex
    WHERE ex.id = student_exam_attempts.exam_id 
      AND ex.status = 'published'::text 
      AND ex.access_type = 'code_based'::text
  )
);

-- 6. EXAM_PUBLIC_CONFIG TABLE
DROP POLICY IF EXISTS exam_public_config_unified_select ON exam_public_config;
DROP POLICY IF EXISTS exam_public_config_admin_insert ON exam_public_config;
DROP POLICY IF EXISTS exam_public_config_admin_update ON exam_public_config;
DROP POLICY IF EXISTS exam_public_config_admin_delete ON exam_public_config;

CREATE POLICY exam_public_config_admin_all ON exam_public_config FOR ALL USING (is_admin());
CREATE POLICY exam_public_config_public_read ON exam_public_config FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM exams ex
    WHERE ex.id = exam_public_config.exam_id AND ex.status = 'published'::text
  )
);

-- 7. APP_SETTINGS TABLE
DROP POLICY IF EXISTS app_settings_unified_select ON app_settings;
DROP POLICY IF EXISTS app_settings_admin_insert ON app_settings;
DROP POLICY IF EXISTS app_settings_admin_update ON app_settings;
DROP POLICY IF EXISTS app_settings_admin_delete ON app_settings;

CREATE POLICY app_settings_admin_all ON app_settings FOR ALL USING (is_admin());
CREATE POLICY app_settings_admin_read ON app_settings FOR SELECT USING (is_admin());
CREATE POLICY app_settings_public_read ON app_settings FOR SELECT USING (true);

-- 8. APP_CONFIG TABLE
DROP POLICY IF EXISTS app_config_unified_select ON app_config;
DROP POLICY IF EXISTS app_config_admin_insert ON app_config;
DROP POLICY IF EXISTS app_config_admin_update ON app_config;
DROP POLICY IF EXISTS app_config_admin_delete ON app_config;

CREATE POLICY app_config_admin_all ON app_config FOR ALL USING (is_admin());
CREATE POLICY app_config_public_read_keys ON app_config FOR SELECT 
USING (key = ANY (ARRAY['system_mode'::text, 'system_disabled'::text, 'system_disabled_message'::text]));

-- Verify rollback
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('exams', 'exam_attempts', 'exam_results', 'students', 
                    'student_exam_attempts', 'exam_public_config', 
                    'app_settings', 'app_config')
ORDER BY tablename, policyname;
