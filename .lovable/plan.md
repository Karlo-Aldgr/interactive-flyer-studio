## Problem

After scanning a menu photo, the new page is created but hotspots either don't appear or only cover some items. Two root causes:

1. **AI silently drops items without `bbox`.** `PagesPanel.handleScanMenu` runs `flatItems = sections.flatMap(s => s.items.filter(it => it.bbox))`. Gemini often returns items without bounding boxes (especially on dense menus), so those items disappear entirely from the page — no hotspot is created for them.
2. **Hotspots are invisible in the editor by default.** Hotspot layers only render an outline when `showHitboxes` is toggled on (see `Canvas.tsx:437`). Right after scanning, the user looks at the new page and sees just the photo with no visible overlays, even when hotspots exist.

## Fix

### 1. Make the edge function return a bbox for every item
`supabase/functions/menu-scan/index.ts`:
- Make `bbox` **required** in the tool schema (move it into `required: ["name","price","category","bbox"]`).
- Strengthen the system prompt: "Every item MUST include a bbox. If unsure, return your best estimate — never omit it."
- In post-processing, if a `bbox` is still missing or zero-sized, synthesize a fallback box by stacking items vertically inside the image (split image height evenly across items in that section). This guarantees every detected item gets a tappable region, even if the model misses a few.

### 2. Stop dropping items in the client
`src/components/editor/PagesPanel.tsx`:
- Remove the `.filter(it => it.bbox)` step — pass all items through and let the store / fallback handle missing boxes.
- Update toast to report total tappable items added.

### 3. Auto-reveal hotspots after a scan
`src/store/editorStore.ts` + `src/components/editor/Canvas.tsx`:
- After `addScannedMenuPage` runs, set `showHitboxes = true` so the new dashed-outline overlays are visible immediately on the canvas. The user can toggle off via the existing button.

### 4. Tighten hotspot defaults so they're actually tappable in the viewer
- Bump the min hotspot size in `addScannedMenuPage` from `Math.max(20, ...)` to `Math.max(40, ...)` so tiny boxes are easier to tap on mobile.

## Files

- `supabase/functions/menu-scan/index.ts` — require bbox, fallback synthesis.
- `src/components/editor/PagesPanel.tsx` — remove bbox filter, update toast.
- `src/store/editorStore.ts` — bump min hotspot size; set `showHitboxes` after scan.
- `src/components/editor/Canvas.tsx` — no behaviour change; verify `showHitboxes` toggle still works.

## Out of scope

- Editing hotspot positions after scan (already supported via drag/resize).
- Re-running scan on an existing page.
