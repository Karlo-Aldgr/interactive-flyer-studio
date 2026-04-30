# Make hotspots repositionable

## Problem

Right now you can draw a hotspot (rectangle or circle), but you can't grab it afterwards to move, resize, or rotate it. That's because the editor's layer renderer doesn't render anything for `hotspot` layers — there's no Konva node to click on, so the selection transformer never attaches.

The hotspot still exists in the data and shows up as a dashed overlay only when "Show hitboxes" is enabled, but it isn't an interactive object on the canvas.

## Fix

Render hotspot layers as an invisible-but-hit-testable shape in the editor so they behave like every other layer:

- Click to select
- Drag to reposition
- Use the transformer handles to resize and rotate
- Use arrow keys to nudge (already works once selected)
- Inspector panel updates position/size like other layers

Rectangle hotspots render as a `Rect`, circle hotspots as an `Ellipse` (matching the `content.hotspotShape` already stored on the layer).

A faint dashed purple outline is drawn so you can see exactly where the hotspot lives even when "Show hitboxes" is off. The fill is essentially fully transparent (alpha ~0.001) — invisible to the viewer's eye but enough for Konva to hit-test the entire shape so you can grab it from anywhere inside.

The published `PublicViewer` is not affected — it has its own rendering path for hotspots and continues to render them as truly invisible tap targets with the configured highlight style.

## Files to change

- `src/components/editor/LayerRenderer.tsx` — add a `case "hotspot"` to the layer type switch that returns a `Rect` or `Ellipse` (based on `content.hotspotShape`) using the shared `commonProps` (which already wires up drag, transform, selection, and rotation handlers).

No database changes, no store changes, no changes to the public viewer.
