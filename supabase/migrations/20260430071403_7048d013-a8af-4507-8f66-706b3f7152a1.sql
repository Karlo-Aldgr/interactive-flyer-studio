CREATE OR REPLACE FUNCTION public.can_manage_flyer_thumbnail(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.flyers f
    WHERE f.owner_id = auth.uid()
      AND f.id::text = regexp_replace(regexp_replace(_object_name, '^.*/', ''), '\.[^.]+$', '')
  );
$$;

DROP POLICY IF EXISTS "Owner can insert flyer thumbnail" ON storage.objects;
DROP POLICY IF EXISTS "Owner can update flyer thumbnail" ON storage.objects;
DROP POLICY IF EXISTS "Owner can delete flyer thumbnail" ON storage.objects;

CREATE POLICY "Owner can insert flyer thumbnail"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'flyer-thumbnails'
    AND public.can_manage_flyer_thumbnail(name)
  );

CREATE POLICY "Owner can update flyer thumbnail"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'flyer-thumbnails'
    AND public.can_manage_flyer_thumbnail(name)
  )
  WITH CHECK (
    bucket_id = 'flyer-thumbnails'
    AND public.can_manage_flyer_thumbnail(name)
  );

CREATE POLICY "Owner can delete flyer thumbnail"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'flyer-thumbnails'
    AND public.can_manage_flyer_thumbnail(name)
  );