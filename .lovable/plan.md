## Goal
Make the shared link preview image match what's shown in the editor — no white/background padding around the flyer.

## Cause
`src/lib/thumbnail.ts` currently composes the share image into a fixed 1200×630 canvas and **contains** the flyer inside it, filling the leftover space with the flyer background color. That's the "extra padding" appearing in link previews. The Cloudflare share worker and `index.html` also hardcode `og:image:width=1200` / `height=630`.

## Changes

1. **`src/lib/thumbnail.ts`**
   - Replace `composeSocialImage` so the output canvas matches the flyer's own aspect ratio (scaled so the longest side ≤ 1200px). No letterbox bars, no background fill — just the flyer pixels.
   - Update `stageToSocialDataURL` to render at the flyer's native aspect at up to 1200px on the longest side.
   - `uploadManualThumbnail` (used when a user uploads their own preview image): stop forcing 1200×630 with padding — preserve the uploaded image's aspect ratio (still cap longest side at 1200 for size).

2. **`worker/share-worker.js`**
   - Remove the hardcoded `og:image:width=1200` / `og:image:height=630` meta tags (or omit dimensions). Social platforms will display the image at its real ratio without padding.

3. **`index.html`**
   - Remove the hardcoded `og:image:width` / `og:image:height` for the site-wide default OG image, so per-flyer images aren't forced into 1.91:1 framing by stale defaults. (The default `og.png` itself is unchanged.)

## Notes
- Existing thumbnails already uploaded with padding will keep their padding until the user re-publishes / regenerates the preview. New publishes will look like the editor.
- Facebook/Messenger/WhatsApp accept arbitrary image aspect ratios; they'll crop to their own preview frame but won't add background padding around the flyer.
