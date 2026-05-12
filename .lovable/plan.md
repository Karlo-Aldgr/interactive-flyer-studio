## Goal
Make the Cloudflare Worker resilient so WhatsApp (and other crawlers) always get a valid `og:image`, even when the Supabase lookup fails or returns no thumbnail.

## Changes to `worker/share-worker.js`

1. **Hard-coded fallback image constant**
   - Add `const FALLBACK_IMAGE = "https://interactive-flyer-studio.lovable.app/og.png";` at the top so we always have a known-good absolute URL (WhatsApp requires absolute https URLs ≥ 300×200).

2. **Simplify and harden `fetchFlyer`**
   - Wrap the `fetch` in a try/catch that returns `null` on any throw, non-2xx, or JSON parse error.
   - Add a 3s `AbortController` timeout so a slow Supabase response can't make WhatsApp give up (WhatsApp times out ~5s).
   - Log failures via `console.log` (visible in Cloudflare tail) so we can see what happened.

3. **Always serve OG HTML to crawlers, even on failure**
   - Today, if `fetchFlyer` throws we still render OG, but the image branch depends on `flyer?.thumbnail_url` / `flyer?.owner_id` / `flyer?.id`. If any are missing, `cleanThumb` returns `null` and we fall back to `${appOrigin}/og.png` — which only works if that file actually exists at the published origin. It currently may not.
   - Replace the fallback chain with the explicit `FALLBACK_IMAGE` constant so there is always a valid absolute URL.
   - Order of preference for `og:image`:
     1. `flyer.thumbnail_url` (stripped of query string)
     2. Constructed Supabase public URL from `owner_id` + `id`
     3. `FALLBACK_IMAGE`

4. **Always return crawler HTML for `/f/:slug`**
   - Even if slug shape doesn't match the regex or Supabase is down, return OG HTML with the fallback image and title "Flyer" rather than 404, so the link never unfurls blank in WhatsApp.

5. **Add a debug header**
   - Include `x-flyer-found: true|false` and `x-image-source: thumbnail|constructed|fallback` so you can `curl -I` and see exactly which path ran without redeploying.

6. **Tighten the crawler regex for WhatsApp**
   - WhatsApp's UA is literally `WhatsApp/2.x` — the current regex matches `whatsapp` case-insensitively, which is fine. Keep as-is but add `;facebookexternalhit` examples to a top-of-file comment for clarity.

## Out of scope
- No app-side code changes.
- No DB changes.
- No new env vars (uses the existing `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_ORIGIN`).

## How to verify after deploy
1. `curl -A "WhatsApp/2.0" https://<worker>/f/<slug> -i` — should return HTML with `og:image` and an `x-image-source` header.
2. Paste link into WhatsApp — preview should appear within ~5s. If `x-image-source: fallback`, the Supabase lookup is failing and we'll know to dig there next.
3. Use Facebook Sharing Debugger to confirm `og:image` is fetched successfully.

## Optional follow-up (only if you want)
- Upload a real branded fallback image to the `flyer-thumbnails` public bucket and point `FALLBACK_IMAGE` at that, so the generic preview is on-brand.
