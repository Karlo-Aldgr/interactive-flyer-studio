## Why the iPhone bubble looks like a giant circle

`AirBubble` derives its visible geometry from many independent inputs that today are scaled inconsistently between editor and viewer:

- `maxWidth` and `fitHeight` are passed in **scaled CSS px** (multiplied by viewport scale).
- Manual `bubble.fontSize` is now also multiplied by `scale` (recent change).
- But `padX`/`padY` use `Math.max(14, fitHeight * 0.32)` and `Math.max(8, fitHeight * 0.18)` — the `14`/`8` floors are absolute CSS px, so on small viewports padding stops scaling proportionally.
- `tailSize` has the same `Math.max(10, …)` floor.
- `MIN_READABLE = 14 * scale` — but the auto-fit branch uses `Math.max(MIN_READABLE, baseFontSize)` where `baseFontSize=22` is unscaled.
- `width: fitHeight ? maxWidth : "auto"` forces the container to the full source-layer width even when the text is short, so any extra height from wrapping or padding turns a wide rounded-rect into a near-circle (border-radius is 9999).

Result: on iPhone the floors dominate, padding and tail are oversized relative to the shrunk text, the bubble is forced to full source-width, and `border-radius: 9999` makes it render as a giant circle. In the editor PC preview none of the floors trigger so the pill looks correct.

## Fix: render the bubble in canvas coordinates, scale the wrapper

Instead of trying to multiply every internal dimension by `scale`, render the bubble at its **native canvas pixel size** (identical to editor PC) and apply a single CSS `transform: scale(scale)` on the wrapping div. This guarantees pixel-perfect parity with the editor PC view on every device — same paddings, same tail, same font, same radius, same wrap points.

### Changes

**`src/components/AirBubble.tsx`**
- Remove the `scale` prop and all `* scale` multiplications.
- Restore `manualSize = bubble.fontSize` (no scale).
- Restore `MIN_READABLE = 14`.
- Keep the rest of the bubble logic unchanged (paddings, tail, radius, auto-fit) — they will operate on canvas-px values just like in the editor.

**`src/pages/PublicViewer.tsx` (`AirMessagesInline`)**
- Compute `rect` in **canvas px** (drop the `* scale`):
  - `left/top/width/height = sourceLayer.position.x / .y / .size.width / .size.height` (unscaled).
  - Fallback rect uses `canvasW * 0.08`, etc. (unscaled).
- `gap = 10` (unscaled).
- `perBubbleHeight` computed from unscaled `rect.height`.
- Wrap the absolute-positioned overlay div in a parent that applies `transform: scale(scale)` with `transformOrigin: "0 0"`, and position that parent at `left: 0, top: 0, width: canvasW * scale, height: canvasH * scale` over the Stage.
- Inner overlay div uses the unscaled `rect` values for `left/top/width/height`.
- Pass `maxWidth={rect.width}` and `fitHeight={perBubbleHeight}` (now canvas px) to `<AirBubble>` — no `scale` prop.

**`src/components/editor/Canvas.tsx`**
- No change needed; it already renders in canvas coords.

### Out of scope
- Image-load gating (already in place).
- Editor mobile-preview behavior, animation, tail logic, color logic.
- Any change to how the source layer rect is authored.

### Files touched
- `src/components/AirBubble.tsx` — remove `scale` prop and multiplications.
- `src/pages/PublicViewer.tsx` — render `AirMessagesInline` content at canvas resolution inside a `transform: scale(scale)` wrapper; drop per-value scaling.
