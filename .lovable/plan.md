# Digital Business Card (BizAd) MVP

The branch `feature/digitalbizad-mvp` is not reachable from this project — only `main` exists here. However, the backend for the feature is already in place: a `bizads` table (one per flyer) with business name, owner name/photo, logo, phone, email, address, about text, social links, gallery + video URLs, flyer image, brand colors, a public `slug`, and an `enabled` flag. RLS is already correct: flyer owners/editors/admins manage rows, and the public can read rows where `enabled = true`.

What is missing is all of the app code. This plan builds the MVP against that existing schema. Nothing in the Meta/social publishing or affiliate areas is touched.

## What gets built

### 1. Public business card page — `/c/:slug`
A mobile-first card page rendered from the `bizads` row:
- Cover/logo, owner photo, business name, owner name, slogan-style about text
- Tap-to-call, email, and address (opens maps) action buttons
- Social link row driven by the `social_links` JSON
- Optional embedded video and a link to the photo gallery
- "View flyer" button when a linked published flyer exists
- "Save contact" button that generates a vCard download
- Brand colors from `background_color` / `button_color`, copyright line in the footer
- Proper page title/description, single H1, and JSON-LD `LocalBusiness` markup

Disabled or unknown slugs render a clean not-found state.

### 2. Card editor for the flyer owner
A "Business card" panel reachable from the flyer's portal/job area, letting the owner or an editor:
- Toggle the card on/off
- Fill in every field above, upload logo / owner photo / flyer image to the existing flyer asset storage
- Add and reorder social links (label + URL)
- Pick background and button colors
- Claim a slug with a live availability check, plus copy-link and QR-style share of the public URL

### 3. Flyer action: "Digital business card"
A new action type so a flyer hotspot opens the card — either as an in-viewer sheet or by linking to `/c/:slug`. This requires one small migration adding `bizad` to the `action_type` enum, plus registering the type in the editor action catalog and the viewer action handler.

## Technical notes

- New route `/c/:slug` in `src/App.tsx`, lazy-loaded like every other page.
- New page `src/pages/PublicBizAd.tsx`, modelled on `src/pages/PublicRealtorProfile.tsx`.
- New `src/lib/bizad.ts` for read/upsert helpers and slug availability checks; public reads go straight through the `enabled = true` RLS policy, so no new RPC is needed.
- New `src/components/bizad/BizAdEditorPanel.tsx`, reusing the existing upload helper in `src/lib/uploadFlyerAsset.ts` and shadcn form primitives.
- One migration: `ALTER TYPE action_type ADD VALUE 'bizad';` — additive only, no table changes, no policy changes.
- Editor wiring: add `bizad` to `ACTION_LABELS` and the "Links & navigation" group in `src/lib/actionCategories.ts`, add the type to `src/types/flyer.ts`, and handle it in the viewer's action dispatcher.
- Untouched: everything under `supabase/functions/meta-*`, `social-*`, `tiktok-*`, and all affiliate pages, tables, and RPCs.
