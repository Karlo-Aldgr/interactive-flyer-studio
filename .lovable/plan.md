## Problem

Clicking "Scan menu image with AI" triggers `new row violates row-level security policy`. The upload path is `${flyerId}/menu-scan-...`, but the `flyer-assets` storage RLS policy requires the **first folder** to be `auth.uid()` (same pattern used by every other uploader in `ActionEditor.tsx`).

## Fix

In `src/components/editor/ActionEditor.tsx` → `MenuSectionsEditor.handleScan`:

1. Pull `user` from `useAuth()` (already imported at the top of the file).
2. Guard: if no `user` or `flyerId`, toast "Sign in required" and abort.
3. Change the upload path from:
   ```
   `${flyerId}/menu-scan-${Date.now()}-${safeName}`
   ```
   to:
   ```
   `${user.id}/${flyerId}/menu-scan/${Date.now()}-${safeName}`
   ```
   This matches the existing `AssetUpload` / gallery upload convention and satisfies the `auth users upload to own folder` policy.

No database, edge function, or other component changes needed.
