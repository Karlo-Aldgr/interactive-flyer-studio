
-- Recreate the UPDATE policy with both USING and WITH CHECK so upserts succeed.
DROP POLICY IF EXISTS "Owner can update flyer thumbnail" ON storage.objects;

CREATE POLICY "Owner can update flyer thumbnail"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'flyer-thumbnails'
    AND EXISTS (
      SELECT 1 FROM public.flyers f
      WHERE f.owner_id = auth.uid()
        AND f.id::text = regexp_replace(storage.objects.name, '\.[^.]+$', '')
    )
  )
  WITH CHECK (
    bucket_id = 'flyer-thumbnails'
    AND EXISTS (
      SELECT 1 FROM public.flyers f
      WHERE f.owner_id = auth.uid()
        AND f.id::text = regexp_replace(storage.objects.name, '\.[^.]+$', '')
    )
  );
