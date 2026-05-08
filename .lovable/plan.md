## Two fixes

### 1. Image loads before hotspots/highlights
Today `KonvaImage` loads asynchronously via `useImage`, while the pulsing highlight ring layer and the hitbox overlay layer render immediately on top. On a slow connection viewers see the rings (and the hotspot dashed outline in preview) before the underlying image appears.

Fix in `src/pages/PublicViewer.tsx`:
- Track per-page image readiness. For every `image` layer on the current page, wait for its `src` to load (use a small `useImagesReady(srcs)` hook backed by `new Image()` + `onload/onerror`, with a 4 s timeout fallback so a broken URL never blocks UI forever).
- Only mount the highlight `KLayer` and the hitbox-overlay `KLayer` once `imagesReady === true`. The main content `KLayer` (which contains the `ImageNode`s themselves) still mounts immediately so the page paints in order: background → image → other layers → highlights.
- Same treatment for popup hotspot overlays in the popup/zoom modals: wait for the popup image to load before rendering its hotspot rings (the existing `<img>` already has `onLoad` we can hook into via state).

### 2. Air-message bubble shape consistent on mobile and desktop
Today `src/components/AirBubble.tsx` uses `useIsMobile()` and overrides the creator's manual `fontSize` on mobile, forcing auto-fit. That changes the text size, which changes the bubble's padding/height/aspect — so a bubble that's a wide pill on desktop becomes a tall capsule on mobile.

Fix in `src/components/AirBubble.tsx` and the two callers:
- Drop the `useIsMobile` branch. Always honor `bubble.fontSize` when set, on every device.
- To keep proportions identical to the editor's PC view, pass a `scale` prop from each caller (`src/pages/PublicViewer.tsx` air-messages overlay and `src/components/editor/Canvas.tsx`) — already computed as the canvas-to-viewport scale (`scale` in PublicViewer, editor's zoom in Canvas). The bubble multiplies the manual `fontSize` (and the `MIN_READABLE` floor used during auto-fit) by this `scale`. `maxWidth`/`fitHeight` are already in scaled px, so the bubble's pill geometry will now match the editor PC look on every viewport.
- Auto-fit fallback (when no `fontSize` is set) keeps working — it already uses `fitHeight`/`maxWidth` which scale with the canvas.

### Out of scope
- Reordering Konva render order beyond what's needed for the image/hotspot sequencing.
- Changing the air-message animation, tail rendering, or color logic.
- Editor mobile-preview behavior beyond what falls out of the scale-prop change.

### Files touched
- `src/pages/PublicViewer.tsx` — image-readiness gating for highlights/hitboxes/popup hotspots; pass `scale` to `<AirBubble>`.
- `src/components/AirBubble.tsx` — remove mobile override, accept `scale` prop, multiply manual font size and min-readable floor by it.
- `src/components/editor/Canvas.tsx` — pass editor `zoom` as `scale` to `<AirBubble>` so editor preview matches viewer 1:1.
