# Hotspot highlight + Trace shape

## 1. The "two tap highlights"

After tracing the code, this is **expected editor behavior**, not a bug:

- In the **editor canvas**, a hotspot layer renders its own dashed outline so you can see and select an otherwise-invisible region (`LayerRenderer.tsx`, hotspot case). On top of that, when the hotspot has an action with highlight enabled, `HighlightOverlay` draws the live preview of the pulse/glow/etc. ring so you can tune color, thickness, opacity.
- On the **published flyer** (`PublicViewer.tsx`), the dashed outline is gone — viewers only see the single highlight ring.

Proposed fix to remove confusion: in the editor, **hide the dashed hotspot outline whenever a highlight is enabled** for that hotspot (the highlight ring already shows where the region is). When highlight is off/none, keep the dashed outline so the hotspot remains visible to the creator. Selected hotspot still gets the standard transformer/selection box either way.

## 2. Add "Trace shape" to hotspot Shape options

Today the Shape dropdown under the Style tab for a hotspot has only Rectangle and Ellipse (`Inspector.tsx` lines 72–84, backed by `LayerContent.hotspotShape: "rect" | "ellipse"`).

Add a third option: **Trace shape** — a free-form polygon the creator draws point-by-point on the canvas to follow an irregular shape (e.g. a logo, a person, a building outline).

### UX

- Style tab → Shape dropdown gains: Rectangle / Ellipse / **Trace shape**.
- Choosing **Trace shape** for a hotspot:
  - Enters a "trace" drawing mode on the canvas.
  - Click to drop points; each click adds a vertex; double-click or press Enter to close the polygon; Esc cancels.
  - A small toolbar tooltip appears: "Click to add points · Double-click to finish · Esc to cancel".
  - Existing points are draggable handles so creators can fine-tune.
  - The hotspot's bounding `position` + `size` are recomputed from the polygon bbox so transform/move still works.
- Editor renders the traced polygon with the same dashed outline treatment as rect/ellipse hotspots.
- Highlight overlay (pulse, glow, solid, dashed, corners, circle) follows the polygon shape:
  - Pulse / glow / solid / dashed → stroke the polygon path.
  - Corners → brackets at the polygon's bbox corners (keeps current visual).
  - Circle → ring around the bbox center (keeps current visual).
- Public viewer hit-testing uses the polygon (point-in-polygon) so taps only register inside the traced area, not the bbox.

### Out of scope

- Curved/bezier handles. Trace is straight-segment polygon only for v1.
- Auto-trace from image (smart detect already exists separately).
- Adding "Trace" as a shape option for non-hotspot layers (shapes, popup-image hotspots).

## Technical details

### Schema (`src/types/flyer.ts`)
- Extend `LayerContent.hotspotShape` to `"rect" | "ellipse" | "polygon"`.
- Add `LayerContent.hotspotPoints?: Array<{ x: number; y: number }>` — coordinates **relative to the layer's `position`/`size` bbox in absolute canvas px** (simplest: store absolute canvas px and recompute bbox on edit). Final choice during impl: absolute canvas px, recompute bbox + normalize on commit.

### Files to touch
- `src/types/flyer.ts` — type extension.
- `src/components/editor/Inspector.tsx` — add "Trace shape" option; when selected and no points yet, show a "Start tracing" button that flips canvas into trace mode; show "Edit points / Clear" when points exist.
- `src/store/editorStore.ts` — add `traceMode` state (which hotspot id is being traced) + setters; helper to commit points and recompute bbox.
- `src/components/editor/Canvas.tsx` — handle trace mode: stage clicks add points, double-click/Enter commits, Esc cancels; render the in-progress polyline + draggable vertex handles; suppress normal selection while tracing.
- `src/components/editor/LayerRenderer.tsx` — hotspot case: when `hotspotShape === "polygon"`, render a Konva `Line` (closed) with dashed stroke instead of Rect/Ellipse. Hide dashed outline when highlight is enabled (fix for #1 above).
- `src/components/editor/HighlightOverlay.tsx` — accept polygon points; for stroke-based styles render a closed `Line` following the points; corners/circle keep bbox-based rendering.
- `src/pages/PublicViewer.tsx` — same polygon rendering for highlight + use point-in-polygon for hit detection on hotspot taps; bbox stays the layer's clickable area only when shape is rect/ellipse.

### Validation
- Trace mode requires ≥3 points to commit; otherwise Esc-cancel.
- Migration: existing hotspots without `hotspotPoints` keep behaving as rect/ellipse — no data migration needed.
