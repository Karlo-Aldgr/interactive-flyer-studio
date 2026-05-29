## Problem

Uploading a social preview image in the Share dialog fails with `new row violates row-level security policy`. The upload target is `flyer-thumbnails/${auth.uid()}/${flyerId}-flyer.jpg` via `upsert: true`.

Two root causes:

1. **Missing SELECT policy** on `storage.objects` for `flyer-thumbnails`. Even though the bucket is public, the storage SDK's `upsert` path performs a read/upsert sequence that needs SELECT for the owner's folder.
2. **Missing `WITH CHECK` on the UPDATE policy** — when an object already exists, `upsert: true` becomes an UPDATE and Postgres requires `WITH CHECK` to validate the new row; with it NULL, the new row check fails for any non-default storage column write.
3. **Silent session drop** — if the auth session expires between page load and Share click, `auth.uid()` is null and the folder check fails. The current error message doesn't make this clear.

## Fix

### 1. Migration: tighten and complete `flyer-thumbnails` storage policies

- Add a `SELECT` policy: owner can read their own folder; keep the bucket public for unfurled URLs (public reads still work via `getPublicUrl` since the bucket itself is public — RLS only governs SDK reads).
- Recreate the `INSERT`/`UPDATE` policies with both `USING` and `WITH CHECK` so upsert works whether the object exists or not.

```sql
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
```

### 2. Client: friendlier error + session re-check in `src/lib/thumbnail.ts`

In `uploadThumbnailBlob`, when the storage error matches `row-level security`, surface a clearer message: "Your session expired or you don't own this flyer. Please sign in again." Also call `supabase.auth.refreshSession()` before retrying once when no session is found.

## Out of scope

- No changes to bucket public-read behavior; share/unfurl links keep working.
- No changes to ShareDialog UI.
