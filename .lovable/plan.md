## Goal

When someone shares a published flyer link on social media (Facebook, X, iMessage, WhatsApp, LinkedIn), show a **preview of that specific flyer** instead of the generic FlyerFlow `/og.png`.

## Why the current setup doesn't work

`index.html` has a hardcoded `<meta property="og:image" content="/og.png">`. Social crawlers (Facebook bot, Twitterbot, etc.) read this static HTML — they don't run the React app, so per-flyer meta tags injected client-side are invisible to them. We need the meta tags to be present in the HTML response *before* JavaScript runs, and we need a real image of the flyer's first page.

## Approach

Two pieces:

### 1. Generate and store a thumbnail of each flyer

The `flyers` table already has a `thumbnail_url` column (visible in `useFlyerData.ts`) but nothing populates it.

- In the editor, after a successful save (debounced, e.g. once every ~10 seconds of idle), render the **first page** of the flyer to an image using Konva's `stage.toDataURL({ pixelRatio: 2, mimeType: 'image/jpeg', quality: 0.85 })`.
- Resize/crop to a 1200×630 social-friendly canvas (with the page centered on the flyer's background color, letterboxed if aspect ratio differs).
- Upload to a new public Supabase Storage bucket `flyer-thumbnails` at path `{flyer_id}.jpg`.
- Update `flyers.thumbnail_url` with the public URL (cache-busted with `?v={timestamp}`).
- Trigger on: manual "Publish", and on autosave when the flyer is already published.

### 2. Serve per-flyer OG meta tags for `/v/:slug` URLs

Because Lovable apps are SPAs served from static HTML, social crawlers won't see React-rendered meta. Solution: a Supabase Edge Function `og-meta` that:

- Takes a `slug` query param.
- Looks up the flyer by `public_slug`, reads `title`, `thumbnail_url`, and a short description.
- Returns a tiny HTML document with proper `<meta property="og:title|og:image|og:description|og:url">` and `<meta name="twitter:*">` tags, plus a `<meta http-equiv="refresh">` redirect to the real `/v/:slug` URL for human visitors.

Then the share URL we hand out (in `ShareDialog`, QR code, copy-link button) becomes:
`https://{project}.supabase.co/functions/v1/og-meta?slug={slug}`

Crawlers fetch it, see the rich preview, index it. Humans get auto-redirected (~0s) to the real interactive flyer at `/v/:slug`. This is the standard pattern when you can't control server-rendered HTML.

### Fallback for the root site

Keep `/og.png` as the default for the marketing/landing pages — only flyer share URLs use the dynamic image.

## Files to change

- `src/hooks/useFlyerData.ts` — add `generateThumbnail()` helper + call it after save when published.
- New `src/lib/thumbnail.ts` — Konva stage → 1200×630 JPEG → upload → returns public URL.
- `src/components/editor/Canvas.tsx` — expose the Konva `Stage` ref (or move thumbnail generation here where the stage lives).
- `src/components/editor/ShareDialog.tsx` — change the shared URL/QR to point at the `og-meta` function URL; show the thumbnail as a preview inside the dialog.
- `src/components/editor/TopBar.tsx` (Publish button) — force a thumbnail regeneration on publish.
- New Supabase Storage bucket `flyer-thumbnails` (public read, authenticated write, RLS so users can only write their own flyer's path).
- New edge function `supabase/functions/og-meta/index.ts` — returns the meta-tag HTML + redirect.

## Technical details

- **Storage RLS**: bucket is public-read; insert/update policy checks `auth.uid() = (select owner_id from flyers where id::text = (storage.foldername(name))[1])` — i.e. filename is `{flyer_id}.jpg` and only the flyer's owner can overwrite it.
- **Edge function**: `verify_jwt = false` (crawlers are anonymous). Uses the service role key only to read public flyer fields.
- **Cache busting**: append `?v={updated_at_epoch}` to `thumbnail_url` so Facebook/Twitter re-scrape after edits. Also include `<meta property="og:image" content="...?v=...">`.
- **Thumbnail dimensions**: 1200×630 is the universal OG/Twitter `summary_large_image` size. The flyer page (typically portrait) is centered with the page's background color filling the rest.
- **Performance**: thumbnail generation runs only after autosave settles AND only if the flyer is published, so editor performance isn't affected.
- **Privacy**: only published flyers get a thumbnail uploaded. Drafts never leave the browser.

## Out of scope

- Generating thumbnails for every page (only page 1 is used as the social image).
- Animated/video previews (OG doesn't support them on most platforms).
- A full SSR rewrite of the app.