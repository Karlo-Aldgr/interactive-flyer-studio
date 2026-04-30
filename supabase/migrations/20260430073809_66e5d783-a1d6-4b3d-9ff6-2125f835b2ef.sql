DROP POLICY IF EXISTS "Public read flyer thumbnails" ON storage.objects;

CREATE POLICY "Public read flyer thumbnails"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'flyer-thumbnails');