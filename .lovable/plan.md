Plan:

1. Make shared preview images use the actual flyer crop only:
   - Keep the thumbnail generator output at the flyer’s own aspect ratio with no white/letterbox background.
   - Ensure regenerated thumbnails overwrite the stored preview image for the flyer.

2. Make the share dialog preview match the real flyer instead of stretching inside a wide preview card:
   - Change the preview image display so it is shown at its natural flyer aspect ratio, centered, without adding white side gutters.
   - Keep the upload/regenerate buttons the same.

3. Refresh the current flyer’s preview:
   - Regenerate the social preview from page 1 after the code change.
   - You’ll still need to copy/share the published `/f/...` link again; some apps cache link previews, so Messenger/iMessage may need a fresh paste or their cache to expire.

Technical details:
- The screenshot is showing a `1200×630` default/social-card-style image with the portrait flyer centered and white on both sides.
- The code already started moving generated thumbnails away from `1200×630`; this pass will make the UI and regeneration path consistently use the flyer-only image.