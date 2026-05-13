# Worker fallback when per-page landing image is missing

## Goal

When the share URL has `?page=<pageId>` and the per-page object `${flyerId}-${pageId}-flyer.jpg` does not exist (404 / not an image), the Worker should fall back to `flyers.thumbnail_url` (and finally `FALLBACK_IMAGE`) so Facebook never receives a broken `og:image`.

## Change (worker/share-worker.js only)

1. Make `pickImage` `async` and pass `request` context so it can do a `HEAD` probe through Cloudflare's edge cache.

2. New helper `imageExists(url)`:
   - `fetch(url, { method: "HEAD", cf: { cacheTtl: 60, cacheEverything: true } })`
   - Returns `true` only when `res.ok` AND `content-type` starts with `image/`.
   - Wrapped in a 1.5s `AbortController` timeout; any error → `false`.

3. New `pickImage` logic:

   ```text
   if (isLanding):
     candidate = `${SUPABASE_URL}/storage/v1/object/public/flyer-thumbnails/${owner}/${flyerId}-${pageId}-flyer.jpg`
     if await imageExists(candidate)  -> { url: candidate, source: "landing-page-variant" }
     else if flyer.thumbnail_url      -> { url: thumb, source: "landing-thumbnail-fallback" }
     else                             -> { url: FALLBACK_IMAGE, source: "fallback" }
   else:
     candidate = `${...}/${flyerId}-flyer.jpg`
     if await imageExists(candidate)  -> { url: candidate, source: "flyer-variant" }
     else if flyer.thumbnail_url      -> { url: thumb, source: "flyer-thumbnail-fallback" }
     else                             -> { url: FALLBACK_IMAGE, source: "fallback" }
   ```

   Strip any `?...` from `flyer.thumbnail_url` before using it (already done today).

4. Update the call site in `fetch()` to `await pickImage(flyer, env, pageId)`. The existing `x-image-source` response header will now reveal which branch was used, which makes future debugging easy from `curl -I`.

5. No changes to redirect logic, canonical URL, OG HTML template, or human-vs-crawler handling.

## Why a HEAD probe is safe here

- Only runs for crawler requests (humans are 302'd before `pickImage`).
- One extra sub-request per crawl, cached at the Cloudflare edge for 60s via `cf.cacheTtl`, so repeat scrapes are effectively free.
- 1.5s timeout guarantees the Worker still responds well within Facebook's crawler budget even if storage is slow.

## No changes needed

- `src/lib/thumbnail.ts` and `src/components/editor/TopBar.tsx` are already correct — they upload the per-page variant with `contentType: "image/jpeg"` to the right path. The fallback only matters for flyers published before that upload code shipped, or pages whose Share dialog has never been opened.

## After deploy

- Re-scrape the affected landing link in Facebook's Sharing Debugger. It should now show the canonical landing thumbnail instead of the broken-image / black area.
- Inspect `x-image-source` on the Worker response to confirm which image was served (`landing-page-variant` once the editor uploads it, `landing-thumbnail-fallback` until then).
