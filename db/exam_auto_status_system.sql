-- Exam Auto Status System Migration
-- Adds support for automatic status computation based on scheduling

-- Add scheduling mode and manual override columns
DO $$ BEGIN
  -- scheduling_mode: 'Auto' (time-based) or 'Manual' (admin controls)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exams' AND column_name = 'scheduling_mode'
  ) THEN
    ALTER TABLE public.exams ADD COLUMN scheduling_mode text NOT NULL DEFAULT 'Auto' CHECK (scheduling_mode IN ('Auto', 'Manual'));
  END IF;

  -- is_manually_published: Override flag to publish before start_time or in manual mode
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exams' AND column_name = 'is_manually_published'
  ) THEN
    ALTER TABLE public.exams ADD COLUMN is_manually_published boolean NOT NULL DEFAULT false;
  END IF;

  -- is_archived: Manual archive flag (hides from students)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exams' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.exams ADD COLUMN is_archived boolean NOT NULL DEFAULT false;
  END IF;

  -- archived_at: When exam was archived
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exams' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.exams ADD COLUMN archived_at timestamptz NULL;
  END IF;

  -- status_note: Optional admin note about status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exams' AND column_name = 'status_note'
  ) THEN
    ALTER TABLE public.exams ADD COLUMN status_note text NULL;
  END IF;
END $$;

-- Migrate existing exams:
-- 1. Set archived exams
UPDATE public.exams 
SET is_archived = true, archived_at = updated_at 
WHERE status = 'archived' AND is_archived = false;

-- 2. Set manually published exams (published but no start_time or before start_time)
UPDATE public.exams 
SET is_manually_published = true 
WHERE status = 'published' 
  AND (start_time IS NULL OR start_time > NOW())
  AND is_manually_published = false;

-- 3. Set scheduling mode to Manual for exams without schedule
UPDATE public.exams 
SET scheduling_mode = 'Manual'
WHERE (start_time IS NULL OR end_time IS NULL)
  AND scheduling_mode = 'Auto';

-- Create function to compute effective exam status
CREATE OR REPLACE FUNCTION public.get_exam_effective_status(
  p_scheduling_mode text,
  p_stored_status text,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_is_manually_published boolean,
  p_is_archived boolean
) RETURNS text AS $$
BEGIN
  -- Archived always wins
  IF p_is_archived THEN
    RETURN 'Archived';
  END IF;
  
  -- Manual mode: admin controls everything
  IF p_scheduling_mode = 'Manual' THEN
    RETURN CASE 
      WHEN p_is_manually_published THEN 'Published'
      ELSE 'Draft'
    END;
  END IF;
  
  -- Auto mode: time-based with override
  IF p_scheduling_mode = 'Auto' THEN
    -- Early publish override
    IF p_is_manually_published AND NOW() < p_start_time THEN
      RETURN 'Published';
    END IF;
    
    -- Standard time-based
    IF NOW() < p_start_time THEN
      RETURN 'Draft';
    ELSIF NOW() < p_end_time THEN
      RETURN 'Published';
    ELSE
      RETURN 'Done';
    END IF;
  END IF;
  
  -- Fallback
  RETURN 'Draft';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create view for exams with computed status
CREATE OR REPLACE VIEW public.exams_with_computed_status AS
SELECT 
  e.*,
  public.get_exam_effective_status(
    e.scheduling_mode,
    e.status,
    e.start_time,
    e.end_time,
    e.is_manually_published,
    e.is_archived
  ) as computed_status,
  CASE
    WHEN e.is_archived THEN false
    WHEN e.scheduling_mode = 'Manual' THEN e.is_manually_published
    WHEN e.scheduling_mode = 'Auto' AND e.is_manually_published AND NOW() < e.end_time THEN true
    WHEN e.scheduling_mode = 'Auto' AND NOW() >= e.start_time AND NOW() < e.end_time THEN true
    ELSE false
  END as is_accessible_to_students
FROM public.exams e;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_exams_scheduling_mode ON public.exams(scheduling_mode);
CREATE INDEX IF NOT EXISTS idx_exams_is_archived ON public.exams(is_archived);
CREATE INDEX IF NOT EXISTS idx_exams_is_manually_published ON public.exams(is_manually_published);
CREATE INDEX IF NOT EXISTS idx_exams_start_time ON public.exams(start_time);
CREATE INDEX IF NOT EXISTS idx_exams_end_time ON public.exams(end_time);

-- Grant permissions
GRANT SELECT ON public.exams_with_computed_status TO authenticated;
GRANT SELECT ON public.exams_with_computed_status TO anon;

COMMENT ON COLUMN public.exams.scheduling_mode IS 'Auto: Time-based status transitions, Manual: Admin controls publish state';
COMMENT ON COLUMN public.exams.is_manually_published IS 'Override flag: publish early in Auto mode or control state in Manual mode';
COMMENT ON COLUMN public.exams.is_archived IS 'Hide exam from students regardless of other settings';
COMMENT ON COLUMN public.exams.archived_at IS 'Timestamp when exam was archived';
COMMENT ON COLUMN public.exams.status_note IS 'Optional note explaining current status';
