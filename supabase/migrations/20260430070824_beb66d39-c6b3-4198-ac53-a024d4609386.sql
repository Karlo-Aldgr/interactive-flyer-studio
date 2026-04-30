
-- Fix flyer-thumbnails storage policies: the previous version used split_part with
-- a negative index which doesn't reliably return the filename, so RLS rejected
-- legitimate uploads from the flyer's owner.

DROP POLICY IF EXISTS "Owner can insert flyer thumbnail" ON storage.objects;
DROP POLICY IF EXISTS "Owner can update flyer thumbnail" ON storage.objects;
DROP POLICY IF EXISTS "Owner can delete flyer thumbnail" ON storage.objects;

-- Files are uploaded as "<flyerId>.jpg". Strip the .jpg extension and match
-- against flyers.id owned by the current user.
CREATE POLICY "Owner can insert flyer thumbnail"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'flyer-thumbnails'
    AND EXISTS (
      SELECT 1 FROM public.flyers f
      WHERE f.owner_id = auth.uid()
        AND f.id::text = regexp_replace(storage.objects.name, '\.[^.]+$', '')
    )
  );

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
  );

CREATE POLICY "Owner can delete flyer thumbnail"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'flyer-thumbnails'
    AND EXISTS (
      SELECT 1 FROM public.flyers f
      WHERE f.owner_id = auth.uid()
        AND f.id::text = regexp_replace(storage.objects.name, '\.[^.]+$', '')
    )
  );
