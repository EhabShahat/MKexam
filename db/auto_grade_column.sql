-- Add auto_grade_on_answer column to questions table
-- This allows paragraph and photo_upload questions to be auto-graded
-- if the student provides any answer (text or photo)

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'questions' 
    AND column_name = 'auto_grade_on_answer'
  ) THEN
    ALTER TABLE public.questions 
    ADD COLUMN auto_grade_on_answer boolean NOT NULL DEFAULT false;
    
    RAISE NOTICE 'Column auto_grade_on_answer added to questions table';
  ELSE
    RAISE NOTICE 'Column auto_grade_on_answer already exists';
  END IF;
END $$;
