# Fix: blank OG image on landing-page share link

## Cause

The Cloudflare Worker now looks for the landing-page OG image at:

```
flyer-thumbnails/{ownerId}/{flyerId}-{pageId}-flyer.jpg
```

But the editor never uploads that file. It only uploads:

- `{flyerId}.jpg` — canonical landing thumbnail (written to `flyers.thumbnail_url`)
- `{flyerId}-flyer.jpg` — direct-flyer variant

So when Facebook crawls `?page=<landingId>`, the Worker points `og:image` at a non-existent object → blank preview.

## Fix

Upload the landing-page capture a second time under the per-page variant path the Worker expects.

### 1. `src/lib/thumbnail.ts`

Add a sibling to `uploadFlyerVariantFromDataUrl`:

```ts
export async function uploadLandingVariantFromDataUrl(
  dataUrl: string,
  flyerId: string,
  pageId: string,
  flyerW: number,
  flyerH: number
): Promise<string>
```

Uploads the composed JPEG to `${userId}/${flyerId}-${pageId}-flyer.jpg` in the `flyer-thumbnails` bucket, `upsert: true`. Does not touch the `flyers` table.

### 2. `src/components/editor/TopBar.tsx`

In `ensureThumbnail`, right after the successful landing-page `generateAndUploadThumbnail` call (around line 171), also upload the same capture as the per-page variant when a landing page exists:

```ts
if (landingPage) {
  const landingData = stageToSocialDataURL(stage, captureW, captureH, bg);
  if (landingData) {
    try {
      await uploadLandingVariantFromDataUrl(
        landingData, flyer.id, landingPage.id, captureW, captureH
      );
    } catch (e) { console.warn("[landing variant upload] failed", e); }
  }
}
```

Same on publish (`togglePublish`, around line 287) so a freshly published flyer immediately has the per-page variant available for crawlers.

### 3. No Worker changes

Worker logic is already correct — it just needs the file to exist.

## After deploy

User must open the Share dialog (or re-publish) once so the new variant uploads, then re-share the landing link. Facebook may cache the old empty preview; using the FB Sharing Debugger to "Scrape Again" will refresh it.
