## Problem
On the public realtor profile, the "234 Hidden Ridge Drive" tile is not clickable while "125 Maple Street" is. Cause: only listings with a `public_slug` render as a link. In the DB, Hidden Ridge has `public_slug = NULL` even though it's `published` + `active`, so its tile renders as a static card.

## Fix

1. **Backfill missing slugs** (DB migration)
   - For every `flyers` row where `status = 'published'` AND `public_slug IS NULL`, call the existing `ensure_flyer_public_slug(id)` helper so a unique slug is generated from the title/address. This immediately makes Hidden Ridge clickable.

2. **Auto-generate slug on publish for realtor listings**
   - In `src/lib/realtor.ts` (publish/toggle path), after setting `status = 'published'`, invoke the `ensure_flyer_public_slug` RPC if `public_slug` is null. Prevents this regression for new listings.

3. **Defensive UI fallback** in `src/pages/PublicRealtorProfile.tsx` `ListingTile`
   - If `public_slug` is still missing, render the tile as a disabled card with a small "Link unavailable" hint instead of looking identical to clickable tiles. (Optional polish — primary fix is #1.)

## Technical notes
- `ensure_flyer_public_slug` already exists (created during the earlier billing/activation work) and produces collision-safe slugs.
- `loadPublicRealtorProfile` already filters to published listings and includes `public_slug`, so no query change needed.
- No type changes required.

## Files
- `supabase/migrations/<new>.sql` — backfill loop
- `src/lib/realtor.ts` — call `ensure_flyer_public_slug` on publish
- `src/pages/PublicRealtorProfile.tsx` — tile fallback (optional)