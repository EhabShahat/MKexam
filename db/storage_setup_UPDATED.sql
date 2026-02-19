-- Storage buckets setup - Updated from Supabase 2025-01-29
-- This file contains all storage buckets from the live database

-- ============================================================================
-- BUCKET: logos
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS policies for logos bucket
DROP POLICY IF EXISTS "Public can view logos" ON storage.objects;
CREATE POLICY "Public can view logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "Anyone can upload logos" ON storage.objects;
CREATE POLICY "Anyone can upload logos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'logos');

DROP POLICY IF EXISTS "Anyone can update logos" ON storage.objects;
CREATE POLICY "Anyone can update logos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "Anyone can delete logos" ON storage.objects;
CREATE POLICY "Anyone can delete logos" ON storage.objects
  FOR DELETE USING (bucket_id = 'logos');

-- ============================================================================
-- BUCKET: question-images
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'question-images',
  'question-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS policies for question-images bucket
DROP POLICY IF EXISTS "Public can view question-images" ON storage.objects;
CREATE POLICY "Public can view question-images" ON storage.objects
  FOR SELECT USING (bucket_id = 'question-images');

DROP POLICY IF EXISTS "Anyone can upload question-images" ON storage.objects;
CREATE POLICY "Anyone can upload question-images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'question-images');

DROP POLICY IF EXISTS "Anyone can update question-images" ON storage.objects;
CREATE POLICY "Anyone can update question-images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'question-images');

DROP POLICY IF EXISTS "Anyone can delete question-images" ON storage.objects;
CREATE POLICY "Anyone can delete question-images" ON storage.objects
  FOR DELETE USING (bucket_id = 'question-images');

-- ============================================================================
-- BUCKET: student-files
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-files',
  'student-files',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf']
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS policies for student-files bucket  
DROP POLICY IF EXISTS "Public can view student-files" ON storage.objects;
CREATE POLICY "Public can view student-files" ON storage.objects
  FOR SELECT USING (bucket_id = 'student-files');

DROP POLICY IF EXISTS "Anyone can upload student-files" ON storage.objects;
CREATE POLICY "Anyone can upload student-files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'student-files');

DROP POLICY IF EXISTS "Anyone can update student-files" ON storage.objects;
CREATE POLICY "Anyone can update student-files" ON storage.objects
  FOR UPDATE USING (bucket_id = 'student-files');

DROP POLICY IF EXISTS "Anyone can delete student-files" ON storage.objects;
CREATE POLICY "Anyone can delete student-files" ON storage.objects
  FOR DELETE USING (bucket_id = 'student-files');

-- Grant necessary permissions
GRANT ALL ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon;
