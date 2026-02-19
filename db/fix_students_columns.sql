-- Fix missing columns in students table
-- Run this migration to add updated_at, photo_url, and national_id_photo_url columns

-- Add updated_at column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.students ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Add photo_url column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE public.students ADD COLUMN photo_url TEXT NULL;
  END IF;
END $$;

-- Add national_id_photo_url column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'national_id_photo_url'
  ) THEN
    ALTER TABLE public.students ADD COLUMN national_id_photo_url TEXT NULL;
  END IF;
END $$;

-- Create or replace function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.tg_set_students_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := NOW();
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.updated_at IS NULL THEN 
      NEW.updated_at := NOW();
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_students_updated_at ON public.students;

-- Create trigger to automatically update updated_at on modifications
CREATE TRIGGER trg_students_updated_at
BEFORE INSERT OR UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.tg_set_students_updated_at();

-- Update the student_exam_summary view to include new columns
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
