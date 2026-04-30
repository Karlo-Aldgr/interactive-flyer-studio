DROP POLICY IF EXISTS "Public read flyer thumbnails" ON storage.objects;

CREATE POLICY "Public read flyer thumbnails"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'flyer-thumbnails'
  AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
);