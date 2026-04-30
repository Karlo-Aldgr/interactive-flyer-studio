-- Files in a public bucket are still served via /object/public/... without needing a SELECT policy.
-- Removing this policy prevents listing all thumbnails while keeping direct image URLs public.
drop policy if exists "Public read flyer thumbnails" on storage.objects;