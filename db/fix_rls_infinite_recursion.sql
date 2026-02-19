-- Fix: Infinite Recursion in RLS Policies for exam_attempts and exam_results
-- Issue: Circular dependency between exam_attempts and exam_results policies
-- Solution: Remove the circular reference by simplifying the policies

-- Drop the problematic policies
DROP POLICY IF EXISTS exam_attempts_public_results_read ON public.exam_attempts;
DROP POLICY IF EXISTS exam_results_public_read ON public.exam_results;

-- Recreate exam_attempts policy WITHOUT checking exam_results
-- Allow public read of exam_attempts only for published exams
CREATE POLICY exam_attempts_public_results_read ON public.exam_attempts
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.exams ex
      WHERE ex.id = public.exam_attempts.exam_id 
      AND ex.status = 'published'
    )
  );

-- Recreate exam_results policy WITHOUT circular reference
-- Allow public read of exam_results only for published exams
CREATE POLICY exam_results_public_read ON public.exam_results
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.exam_attempts ea
      JOIN public.exams ex ON ex.id = ea.exam_id
      WHERE ea.id = public.exam_results.attempt_id 
      AND ex.status = 'published'
    )
  );

-- Verify policies are created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('exam_attempts', 'exam_results')
ORDER BY tablename, policyname;
