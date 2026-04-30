## What's wrong

Two real problems explain your screenshots:

1. **No thumbnail image is saved.** The flyer in the database (`Untitled flyer`) has `thumbnail_url = NULL`. The `og-meta` edge function therefore falls back to `https://interactive-flyer-studio.lovable.app/og.png` — a static file that doesn't exist. So Facebook fetches a non-existent image and shows no preview card.
2. **The share URL is the raw Edge Function URL.** Messenger displays `https://iwmykqilqywbzxpcgaop.supabase.co/functions/v1/og-meta?slug=…&site=…` as plain text instead of a card, partly because there's no valid OG image and partly because that URL looks like noise to users.

The thumbnail-generation code only runs when you click **Publish** (status flip draft → published). Since this flyer was already published before that code shipped, the thumbnail was never created. Autosave-time regeneration only runs when you have page 1 selected AND you're actively editing.

## Plan

### 1. Generate the thumbnail on demand (most important fix)

In `src/components/editor/TopBar.tsx`, when the user opens the **Share** dialog and `flyer.thumbnail_url` is missing — or whenever they click a "Refresh preview" button — render the first page and upload it. Steps:

- Add a small helper `ensureThumbnail()` that:
  - Switches to page 1 if not already there (briefly).
  - Waits ~250 ms for Konva to paint.
  - Calls `generateAndUploadThumbnail(...)` from `src/lib/thumbnail.ts`.
  - Updates the local store's `flyer.thumbnail_url` so the Share dialog preview updates.
- Trigger `ensureThumbnail()` automatically when opening Share if `thumbnail_url` is empty.
- Add a "Regenerate preview" button inside `ShareDialog.tsx` so the user can refresh after edits.

### 2. Make the share URL friendly

Right now the share URL is the long Edge Function URL. Switch the share URL shown to users to the clean `/f/:slug` viewer URL, and instead make the Edge Function the **canonical OG meta source** referenced from the viewer page. Concretely:

- In `TopBar.tsx`, set `publicUrl = viewerUrl` (i.e. `https://interactive-flyer-studio.lovable.app/f/<slug>`).
- In the public viewer route (`/f/:slug`), inject per-flyer OG/Twitter meta tags into `<head>` via React (using `react-helmet-async` or a small `useEffect` that mutates `document.head`). This way social crawlers that execute JS (Facebook, LinkedIn, X) see the correct image. We will set:
  - `og:title` = flyer title
  - `og:description` = flyer description
  - `og:image` = `flyer.thumbnail_url`
  - `og:url` = canonical viewer URL
  - matching `twitter:*` tags

  Note: Facebook's crawler does NOT execute JS reliably, so we keep the Edge Function as a backup option and also add a prerender-friendly approach: for crawlers, the viewer route can server-side-redirect to og-meta. But the simplest robust approach is:
  
  **Recommended approach**: keep using the og-meta Edge Function URL as the share URL, but display it in the UI as a shortened label ("Copy link" copies the og-meta URL; the Input shows the friendly viewer URL with a small note "social-optimized"). On click of native share / WhatsApp / Facebook buttons, send the og-meta URL (because those crawlers need the OG-tagged HTML); on display, show the viewer URL.

We'll go with the Recommended approach — it's the least invasive and matches the existing architecture. The user-visible Input will show the clean viewer URL; the social-share buttons will use the og-meta URL under the hood.

### 3. Make `og-meta` more robust

In `supabase/functions/og-meta/index.ts`:

- If `thumbnail_url` is missing, try to construct the public storage URL directly from `flyer-thumbnails/<flyerId>.jpg` (it may exist even if the DB column wasn't updated due to a previous race).
- Add a cache-busting `?v=` derived from the flyer's `updated_at`.
- Strip the `?v=` cache-buster from the stored thumbnail_url BEFORE serving (some crawlers reject querystrings on og:image). Serve a stable URL.

### 4. Backfill the existing published flyer

After the Share dialog auto-regenerates thumbnails, simply opening Share once for `Untitled flyer` will populate `thumbnail_url`. No DB migration needed.

## Technical details

**Files to edit**
- `src/components/editor/TopBar.tsx` — add `ensureThumbnail()`, call on Share open; show clean viewer URL while passing og-meta URL to social buttons.
- `src/components/editor/ShareDialog.tsx` — accept two URLs (display + share-with-crawlers), add "Regenerate preview" button, show loading state during regeneration.
- `src/lib/thumbnail.ts` — export the upload path (`flyer-thumbnails/<id>.jpg`) helper; allow `generateAndUploadThumbnail` to return the **clean** URL (without cache-buster) and store the clean URL in DB, while UI uses cache-busted variant for `<img>` only.
- `supabase/functions/og-meta/index.ts` — fall back to constructed storage URL; sanitize cache-buster.

**No DB migration required.** No new dependencies.

## Out of scope
- Server-rendering the `/f/:slug` page (would need an SSR setup we don't have).
- Deleting old `og.png` references — there's no static file to remove.