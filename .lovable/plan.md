## Goal
Make the public flyer's **Realtor gallery** hotspot match the realtor portal's Photos button: open the grid, and tapping a staged tile launches the fullscreen Before / After slider.

## Diagnosis
The data path is fine — the public anon API does return `staged_url`, and the `RealtorGalleryDialog` already renders a "Before / After" badge and routes tile clicks into the fullscreen viewer that wraps `ViewerBeforeAfter`. The problem is discoverability/UX:
- The "Before / After" badge is small and easy to miss.
- The tile looks identical to a non-staged photo, so users don't realize the tap will reveal staging.
- The fullscreen slider has no explicit "Before / After" labels, so a first-time tap can feel like "it just showed the photo".

## Changes (UI only, in `src/pages/PublicViewer.tsx` → `RealtorGalleryDialog`)

1. **Tile affordance for staged photos**
   - Replace the small corner pill with a clearer overlay on staged tiles:
     - Bottom gradient strip with text: `Tap to compare · Before / After`.
     - Keep the corner badge but enlarge it slightly and add a split-circle icon.
   - Add a subtle ring (`ring-2 ring-primary/60`) around staged tiles so they stand out from regular ones.

2. **Auto-open the slider on tap (already wired)**
   - Confirm `onClick={() => setViewerIndex(idx)}` opens fullscreen; for staged photos this already mounts `ViewerBeforeAfter`. No logic change, just verify.

3. **Fullscreen Before / After clarity**
   - Add fixed `Before` and `After` labels in the top-left and top-right of the slider container (white text, black/40 chip).
   - Add a one-time hint toast on the slider: "Drag the handle to compare" that auto-dismisses after ~2.5s.
   - Make the drag handle slightly larger and add a `↔` cursor on hover.

4. **Single-photo convenience (small win)**
   - If the listing has exactly one photo AND it has `staged_url`, still show the grid for consistency but pre-highlight that tile with a pulsing ring so the user immediately taps it.

No DB, no RLS, no action-payload changes. Purely presentational tweaks to the existing dialog.

## Out of scope
- Changing the action payload schema.
- Editing the realtor portal's `PhotoGalleryModule` (already works as the reference).
- Making each tile an inline mini-slider (rejected option).