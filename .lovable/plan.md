## Problem

The "Save failed" error happens because the database `action_type` enum doesn't include the new `realtor_gallery` value yet. The frontend type was updated, but the backend enum was not, so Postgres rejects the insert/update.

## Fix

1. **Migration** — add `'realtor_gallery'` to the `public.action_type` Postgres enum so actions can persist.

```sql
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'realtor_gallery';
```

That's the only change required for the save to succeed. The viewer dialog, ActionEditor picker, and listing lookup added in the previous turn are already wired up and will start working as soon as the enum accepts the value.

## On your second question — "is there a gallery for the listing"

Yes. Each realtor listing already has its own photo gallery:

- **Editor side:** `src/components/realtor/PhotoGalleryModule.tsx` on the listing page (`/realtor/listing/:id`) — drag-and-drop uploads, optional staged before/after companions.
- **Standalone public view:** `src/pages/RealtorGalleryIndex.tsx` lists galleries, and the per-listing gallery is what the new `realtor_gallery` flyer action opens inside the viewer (`PublicViewer.tsx` reads `listing_photos` for the chosen `realtorListingId`).

So once the enum is patched, picking a listing in the new action will open that listing's existing gallery (with the "Staged" badges where a before/after exists).
