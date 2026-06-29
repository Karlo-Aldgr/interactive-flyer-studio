Add an optional "staged (before/after)" companion photo to each tile in the realtor portal's Photo Gallery — mirroring the editor's Photo Gallery interaction (photo 2). When set, viewers see a before/after slider in the fullscreen viewer.

## What changes for the realtor

On each tile in `/realtor/listing/:id`:
- New small button under the main photo: **+ Add staged (before/after)**
- Once uploaded, the tile shows a tiny corner badge "Staged" and a **Remove staged** action
- In the fullscreen viewer, if a tile has a staged photo, a draggable before/after slider compares the main and staged photo

Public profile / future public listing view: the same before/after slider renders in the viewer when a staged image exists.

## Technical notes

1. Database migration on `public.listing_photos`:
   - Add column `staged_url text`
   - Keep existing RLS / grants

2. `src/lib/realtor.ts`:
   - Extend `ListingPhoto` type with `staged_url: string | null`
   - Add `staged_url` to all `select(...)` strings
   - Add helpers:
     - `uploadStagedListingPhoto({ ownerId, flyerId, photoId, file })` — uploads to the same `flyer-assets` path scheme, then updates the row
     - `clearStagedListingPhoto(id)` — sets `staged_url` back to null
   - Allow `staged_url` in `updateListingPhoto`'s patch type

3. `src/components/realtor/PhotoGalleryModule.tsx`:
   - In `SortablePhotoTile`: add a small hidden file input + "+ Staged" / "Remove staged" buttons under the category select, with a "Staged" badge on the thumbnail when present
   - In the fullscreen viewer: when the current photo has `staged_url`, render a draggable before/after comparator (clip-path based, single component inside this file — no new deps) instead of the plain `<img>`. Show small "Before / After" labels.

4. No changes needed to public viewer in this pass beyond the realtor portal's own fullscreen viewer; if the user later wants the public listing page to expose the slider too, that's a follow-up.

5. Storage: reuse the existing public `flyer-assets` bucket and same path layout (`{ownerId}/listings/{flyerId}/{uuid}.{ext}`).
