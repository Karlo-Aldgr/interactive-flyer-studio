DROP POLICY IF EXISTS "Owner can insert flyer thumbnail" ON storage.objects;
DROP POLICY IF EXISTS "Owner can update flyer thumbnail" ON storage.objects;
DROP POLICY IF EXISTS "Owner can delete flyer thumbnail" ON storage.objects;

CREATE POLICY "Owner can read flyer thumbnail" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'flyer-thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner can insert flyer thumbnail" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'flyer-thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner can update flyer thumbnail" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'flyer-thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'flyer-thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner can delete flyer thumbnail" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'flyer-thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text);