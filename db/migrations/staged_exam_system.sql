-- Staged Exam System Migration
-- Adds support for multi-stage exams with video, content, and questions stages
-- Safe to run repeatedly due to IF NOT EXISTS checks

-- ============================================================================
-- 1. exam_stages table
-- ============================================================================
-- Stores stage definitions for each exam (Video, Content, Questions)

CREATE TABLE IF NOT EXISTS public.exam_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  stage_type text NOT NULL CHECK (stage_type IN ('video', 'content', 'questions')),
  stage_order integer NOT NULL,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_stages_unique_order UNIQUE (exam_id, stage_order)
);

-- Index for efficient stage retrieval ordered by stage_order
CREATE INDEX IF NOT EXISTS idx_exam_stages_exam_order 
  ON public.exam_stages (exam_id, stage_order);

-- ============================================================================
-- 2. attempt_stage_progress table
-- ============================================================================
-- Tracks student progress through each stage

CREATE TABLE IF NOT EXISTS public.attempt_stage_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.exam_stages(id) ON DELETE CASCADE,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  progress_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attempt_stage_progress_unique UNIQUE (attempt_id, stage_id)
);

-- Indexes for efficient progress retrieval
CREATE INDEX IF NOT EXISTS idx_attempt_stage_progress_attempt 
  ON public.attempt_stage_progress (attempt_id);

CREATE INDEX IF NOT EXISTS idx_attempt_stage_progress_stage 
  ON public.attempt_stage_progress (stage_id);

-- ============================================================================
-- 3. Grants for service_role
-- ============================================================================
-- Ensure service_role has necessary permissions

GRANT ALL ON public.exam_stages TO service_role;
GRANT ALL ON public.attempt_stage_progress TO service_role;

-- ============================================================================
-- 4. Trigger for auto-updating updated_at
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Trigger for exam_stages
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_exam_stages_updated_at'
  ) THEN
    CREATE TRIGGER trg_exam_stages_updated_at
    BEFORE UPDATE ON public.exam_stages
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;
END $$;

-- Trigger for attempt_stage_progress
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_attempt_stage_progress_updated_at'
  ) THEN
    CREATE TRIGGER trg_attempt_stage_progress_updated_at
    BEFORE UPDATE ON public.attempt_stage_progress
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;
END $$;

-- ============================================================================
-- Migration complete
-- ============================================================================
-- Tables created:
--   - exam_stages: Stage definitions (video, content, questions)
--   - attempt_stage_progress: Student progress through stages
--
-- Backward compatibility: Existing exams without stages continue to work
-- ============================================================================
