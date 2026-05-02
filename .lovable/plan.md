# Fix: Popup hotspots un-clickable because image keeps enlarging

## Problem

In the public viewer, when a popup opens with an image that has hotspots, clicking anywhere on/near the image enlarges it (lightbox), making the hotspot regions feel un-clickable. Even though hotspot buttons sit above the image, any miss (or any browser/touch quirk) triggers the image's "click to enlarge" handler — and on touch devices the tap target collisions make the hotspots especially hard to hit.

## Fix

Change the popup image so that:

1. When the popup has **one or more hotspots**, the image itself is **no longer click-to-enlarge**. Hotspots become the only interactive elements on the image. This guarantees every click on a hotspot region triggers its action.
2. A small **"Enlarge" button** (icon + label, top-right corner over the image) is shown so users can still open the full-size lightbox on demand.
3. When the popup has **no hotspots**, behavior stays exactly as today (whole image is click-to-enlarge).

Same treatment applies to the buy_ticket image if/when hotspots are added there (currently it has none, so no change needed for that branch right now).

## Files to edit

- `src/pages/PublicViewer.tsx` — the popup `<Dialog>` block (around lines 710–740):
  - Remove `cursor-zoom-in` and `onClick={() => setZoomImage(...)}` from the `<img>` when `popup.payload.hotspots?.length > 0`.
  - Render an absolutely-positioned "Enlarge" button (top-right, small, semi-transparent background, uses the existing `Maximize2` lucide icon) that calls `setZoomImage(popup.payload.mediaUrl!)`.
  - Keep current behavior (image is the zoom trigger) when there are no hotspots.

## Out of scope

- No changes to the editor, hotspot data model, or analytics.
- No changes to the lightbox dialog itself.
