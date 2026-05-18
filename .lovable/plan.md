## Plan

Fix the blank dashboard image for flyers whose saved `thumbnail_url` points to an all-white generated preview.

### What I found
- The dashboard card is trying to show `thumbnail_url`, and for **Hands On Concierge Services** that URL exists.
- The saved thumbnail file itself is blank white, so the dashboard is displaying exactly what was saved.
- The likely cause is thumbnail capture running before Konva image layers finish loading, especially after changing pages or publishing.

### Changes to make
1. Add a reusable helper in `src/lib/thumbnail.ts` that waits for all Konva image nodes on the stage to finish loading before capturing.
2. Use that helper anywhere thumbnails are generated:
   - publish flow
   - share dialog preview regeneration
   - autosave thumbnail generation
3. Improve dashboard fallback behavior:
   - if the saved thumbnail image fails to load, fall back to the first image layer from the flyer page when available.
   - keep the current placeholder only when no thumbnail or page image exists.

### Result
Newly generated thumbnails should show the actual flyer image instead of a blank white card, and the dashboard will be more resilient for existing flyers with bad/missing thumbnail URLs.