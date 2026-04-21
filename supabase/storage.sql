-- ============================================================
-- HUELLITAS - Supabase Storage Setup
-- ============================================================

-- Create the photos bucket (public = anyone can read URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT DO NOTHING;

-- Anyone can view photos (bucket is public, but policy still required)
CREATE POLICY "photos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');

-- Authenticated users can upload
CREATE POLICY "photos_auth_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'photos' AND auth.uid() IS NOT NULL);

-- Users can replace their own files
CREATE POLICY "photos_own_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'photos' AND owner = auth.uid()::text);

-- Users can delete their own files
CREATE POLICY "photos_own_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'photos' AND owner = auth.uid()::text);
