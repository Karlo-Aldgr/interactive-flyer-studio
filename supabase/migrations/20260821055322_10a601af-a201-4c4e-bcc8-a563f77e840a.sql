CREATE POLICY "social assets read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'social-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "social assets insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'social-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "social assets update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'social-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "social assets delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'social-assets' AND auth.uid()::text = (storage.foldername(name))[1]);