# Fix: Air-message bubbles ignore layer order in preview

## Problem

In the editor, the white hand image is the top layer and correctly renders above the "FOLLOW OUR TIKTOK PAGE" air-message bubble (photo 2). In Preview / published view (photo 1), the same hand image disappears behind the bubble.

## Root cause

`src/pages/PublicViewer.tsx` renders the page in two stacked layers:

1. A Konva `<Stage>` containing all real layers (image, hotspot, text, etc.) sorted by `z_index`.
2. An HTML `<AirMessagesInline>` overlay (lines ~800-815) rendered as a sibling `div` *after* the `<Stage>`.

Because the overlay is a separate DOM node sitting on top of the canvas, every air-message bubble is always painted above every Konva layer, regardless of `z_index`. The editor was already fixed by moving the bubble previews into the Konva render loop; the viewer was not.

## Fix

Mirror the editor approach in `PublicViewer.tsx`:

1. Build a Konva-based `AirBubbleKonva` renderer (Group + Rect + Text + tail Line + optional KonvaImage), matching the visual style of the existing HTML `AirBubble` component (background color, text color, font size, padding, tail direction, optional avatar/image).
2. Inside the `<KLayer>` map at line ~725, when iterating `sorted` layers, also check whether any active `airMessages` entry has `am.layer.id === l.id`. If so, render the Konva bubble in the same iteration step (after the layer, in the same Group), so it inherits the layer's z position. Bubbles whose `sourceLayer` is null (page-level air messages) render at the very top of the layer list, as today.
3. Remove the HTML `<AirMessagesInline>` block (lines 800-815). Keep the close button and click handlers wired through Konva `onClick` / `onTap` on the bubble Group.
4. Preserve existing behavior: `onClose` removes the bubble from `airMessages`, tapping the bubble runs `onRunBubbleAction`, scale/positioning uses the Stage's coordinate space (no more manual `scale`/`canvasW`/`canvasH` math needed since we're inside the Stage).

## Files to change

- `src/pages/PublicViewer.tsx` — add Konva air-bubble component, integrate into the sorted-layer render loop, delete the HTML overlay block.

## Out of scope

- Editor canvas (already fixed).
- `AirBubble.tsx` HTML component (still used elsewhere if needed; left untouched).
- Any data model / store changes.
- Popup, video, form, coupon dialogs — unrelated.

## Validation

After the change, in the published `/f/:slug` view: trigger the air-message, confirm the white hand image renders above the bubble, matching the editor (photo 2). Confirm the close (×) button and bubble tap-to-action still work, and that bubbles whose source layer is below the hand are correctly occluded by the hand.
