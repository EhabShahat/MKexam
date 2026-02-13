-- ============================================================================
-- Scoring System Comprehensive Fix - Database Migration
-- ============================================================================
-- This migration adds new columns and tables to support:
-- 1. Configurable missing attempt strategies
-- 2. Score caching for performance
-- 3. Comprehensive audit logging
-- 4. Excused absences for fair attendance calculation
-- ============================================================================

-- ============================================================================
-- PHASE 1: Extend app_settings with Scoring Configuration
-- ============================================================================

-- Add missing attempt strategy configuration
-- Determines how to handle students who haven't attempted published exams
ALTER TABLE IF EXISTS public.app_settings
  ADD COLUMN IF NOT EXISTS result_missing_attempt_strategy TEXT 
    DEFAULT 'zero_score' 
    CHECK (result_missing_attempt_strategy IN ('zero_score', 'exclude_from_calculation', 'custom_value'));

-- Add custom value for missing attempts (used when strategy is 'custom_value')
-- Must be between 0 and 100 (percentage)
ALTER TABLE IF EXISTS public.app_settings
  ADD COLUMN IF NOT EXISTS result_missing_attempt_custom_value NUMERIC(5,2) 
    DEFAULT 0 
    CHECK (result_missing_attempt_custom_value >= 0 AND result_missing_attempt_custom_value <= 100);

-- Add cache version for score invalidation
-- Incrementing this value invalidates all cached scores
ALTER TABLE IF EXISTS public.app_settings
  ADD COLUMN IF NOT EXISTS score_cache_version INTEGER 
    DEFAULT 1;

-- Add sync timestamps for tracking when auto-calculated fields were last updated
ALTER TABLE IF EXISTS public.app_settings
  ADD COLUMN IF NOT EXISTS last_attendance_sync_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.app_settings
  ADD COLUMN IF NOT EXISTS last_assessment_sync_at TIMESTAMPTZ;

-- ============================================================================
-- PHASE 2: Create cached_scores Table
-- ============================================================================

-- Table to store calculated final scores with component breakdown
-- Improves performance by avoiding recalculation on every request
CREATE TABLE IF NOT EXISTS public.cached_scores (
  student_id UUID PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  final_score NUMERIC(5,2),
  component_breakdown JSONB NOT NULL,
  calculation_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cache_version INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on cache_version for efficient invalidation checks
CREATE INDEX IF NOT EXISTS idx_cached_scores_cache_version 
  ON public.cached_scores(cache_version);

-- Index on updated_at for maintenance and monitoring
CREATE INDEX IF NOT EXISTS idx_cached_scores_updated_at 
  ON public.cached_scores(updated_at);

-- Enable RLS for cached_scores
ALTER TABLE IF EXISTS public.cached_scores ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy for cached_scores
DO $do$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
      AND tablename='cached_scores' 
      AND policyname='cached_scores_admin_all'
  ) THEN
    EXECUTE 'DROP POLICY cached_scores_admin_all ON public.cached_scores';
  END IF;
  EXECUTE 'CREATE POLICY cached_scores_admin_all ON public.cached_scores FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
END $do$;

-- ============================================================================
-- PHASE 3: Create score_audit_log Table
-- ============================================================================

-- Table to track all score changes for debugging and accountability
CREATE TABLE IF NOT EXISTS public.score_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'score_calculated',
    'score_recalculated',
    'manual_update',
    'attendance_synced',
    'config_changed'
  )),
  old_value NUMERIC(5,2),
  new_value NUMERIC(5,2),
  component_breakdown JSONB,
  triggered_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on student_id + created_at for efficient student history queries
CREATE INDEX IF NOT EXISTS idx_score_audit_student_created 
  ON public.score_audit_log(student_id, created_at DESC);

-- Index on created_at for chronological queries
CREATE INDEX IF NOT EXISTS idx_score_audit_created 
  ON public.score_audit_log(created_at DESC);

-- Index on event_type for filtering by event type
CREATE INDEX IF NOT EXISTS idx_score_audit_event_type 
  ON public.score_audit_log(event_type);

-- Enable RLS for score_audit_log
ALTER TABLE IF EXISTS public.score_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy for score_audit_log
DO $do$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
      AND tablename='score_audit_log' 
      AND policyname='score_audit_log_admin_all'
  ) THEN
    EXECUTE 'DROP POLICY score_audit_log_admin_all ON public.score_audit_log';
  END IF;
  EXECUTE 'CREATE POLICY score_audit_log_admin_all ON public.score_audit_log FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
END $do$;

-- ============================================================================
-- PHASE 4: Extend attendance_records with Excused Absences
-- ============================================================================

-- Check if attendance_records table exists before altering
DO $do$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' 
      AND table_name='attendance_records'
  ) THEN
    -- Add excused absence support
    ALTER TABLE public.attendance_records
      ADD COLUMN IF NOT EXISTS excused BOOLEAN DEFAULT FALSE;
    
    ALTER TABLE public.attendance_records
      ADD COLUMN IF NOT EXISTS excuse_reason TEXT;
    
    ALTER TABLE public.attendance_records
      ADD COLUMN IF NOT EXISTS excused_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL;
    
    ALTER TABLE public.attendance_records
      ADD COLUMN IF NOT EXISTS excused_at TIMESTAMPTZ;
    
    -- Index for efficient queries on excused absences
    CREATE INDEX IF NOT EXISTS idx_attendance_records_student_excused 
      ON public.attendance_records(student_id, excused);
  END IF;
END $do$;

-- ============================================================================
-- PHASE 5: Cache Invalidation Triggers
-- ============================================================================

-- Function to invalidate cached score for a student
CREATE OR REPLACE FUNCTION public.invalidate_score_cache_on_result()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.cached_scores WHERE student_id = NEW.student_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on exam_results to invalidate cache when results change
DROP TRIGGER IF EXISTS trigger_invalidate_cache_on_exam_result ON public.exam_results;
CREATE TRIGGER trigger_invalidate_cache_on_exam_result
AFTER INSERT OR UPDATE ON public.exam_results
FOR EACH ROW
EXECUTE FUNCTION public.invalidate_score_cache_on_result();

-- Function to invalidate cached score when extra scores change
CREATE OR REPLACE FUNCTION public.invalidate_score_cache_on_extra()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.cached_scores WHERE student_id = NEW.student_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on extra_scores to invalidate cache when extra scores change
DROP TRIGGER IF EXISTS trigger_invalidate_cache_on_extra_score ON public.extra_scores;
CREATE TRIGGER trigger_invalidate_cache_on_extra_score
AFTER INSERT OR UPDATE ON public.extra_scores
FOR EACH ROW
EXECUTE FUNCTION public.invalidate_score_cache_on_extra();

-- ============================================================================
-- PHASE 6: Verification and Comments
-- ============================================================================

-- Add comments for documentation
COMMENT ON COLUMN public.app_settings.result_missing_attempt_strategy IS 
  'Strategy for handling missing exam attempts: zero_score (default, count as 0), exclude_from_calculation (omit from average), custom_value (use configured value)';

COMMENT ON COLUMN public.app_settings.result_missing_attempt_custom_value IS 
  'Custom value (0-100) to use for missing attempts when strategy is custom_value';

COMMENT ON COLUMN public.app_settings.score_cache_version IS 
  'Version number for score cache invalidation. Increment to invalidate all cached scores.';

COMMENT ON COLUMN public.app_settings.last_attendance_sync_at IS 
  'Timestamp of last attendance sync operation';

COMMENT ON COLUMN public.app_settings.last_assessment_sync_at IS 
  'Timestamp of last assessment (quiz/homework) sync operation';

COMMENT ON TABLE public.cached_scores IS 
  'Cached final scores with component breakdown for performance optimization';

COMMENT ON TABLE public.score_audit_log IS 
  'Audit trail of all score changes for debugging and accountability';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- To apply this migration:
--   1. Backup your database
--   2. Run: psql -d your_database -f db/scoring_system_migration.sql
--   3. Verify tables and columns were created successfully
--   4. Test with a sample score calculation
-- ============================================================================
