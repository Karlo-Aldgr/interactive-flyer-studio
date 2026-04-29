## Goals

1. **Show hitbox overlay** — a toggle that highlights all clickable areas (layers + hotspots with actions) so creators can see what's tappable.
2. **Save Action button** — explicit "Save action" in the Action editor that commits a draft action; until saved, the action isn't applied to the layer.
3. **Device size toggle** — switch the canvas frame between desktop/tablet/mobile/custom presets, with a crop tool to trim the artboard to the new size.
4. **Multi-page** — make the existing pages bar more usable (rename, duplicate, reorder, thumbnails) and surface it in a clear side panel.
5. add share feature, include a qr code

---

## 1. Show clickable hitbox overlay

- Add `showHitboxes: boolean` to `editorStore` with a `toggleHitboxes` action.
- New toolbar/topbar button (`Eye` / `Crosshair` icon, label "Show clickable areas") to toggle it.
- In `Canvas.tsx`, when `showHitboxes` is true, render a non-interactive overlay layer above everything: for each layer where `layer.action` exists (or `type === "hotspot"`), draw a dashed purple rect/ellipse matching its bounds with a small "click" badge in the corner showing the action type label.
- Mirror the same toggle in `PublicViewer.tsx` only when `previewMode` is true (preview gets a "Show hotspots" pill button in the top banner). Production viewers never see it.

## 2. Save Action button (lock-in)

Currently `ActionEditor` mutates `layer.action` on every keystroke via `setLayerAction`. We'll change it to a draft pattern:

- `ActionEditor` keeps a local `draft: LayerAction | null` initialized from `props.action`.
- All field edits update `draft` only (local state) — they no longer call `onChange` immediately.
- Add two buttons at the bottom:
  - **Save action** (primary) — calls `onChange(draft)` to commit; shows toast "Action saved".
  - **Discard** (ghost) — resets `draft` back to `props.action`.
- A "dirty" indicator dot shows on the Action tab label when `draft` differs from saved.
- A small `Lock` icon + "Action saved" hint shows when committed; the canvas hover/cursor effect and preview interactivity only respond to saved actions (no behavior change needed since we only commit on save).
- Validation: Save button is disabled when required fields for the chosen action type are empty (e.g. URL for `open_url`, phone for `call`, dates for `add_to_calendar`).

## 3. Device size toggle + crop

- Add a device preset dropdown to `TopBar` next to the zoom controls:
  - Presets: **Story 9:16 (1080×1920)**, **Portrait 4:5 (1080×1350)**, **Square 1:1 (1080×1080)**, **Landscape 16:9 (1920×1080)**, **A4 portrait (2480×3508)**, **Custom**.
- Selecting a preset opens a confirm dialog with three modes:
  - **Resize canvas** — change `flyer.settings.width/height` only; layers keep their absolute positions.
  - **Scale to fit** — scale all layer positions/sizes proportionally to the new canvas.
  - **Crop** — open a crop overlay on the canvas: a draggable/resizable rectangle of the target aspect ratio; on confirm, translate all layer positions so the crop rect becomes the new artboard origin and resize the artboard to the crop dimensions. Layers fully outside the crop are removed (with a confirmation count).
- Persist the chosen size to `flyers.settings` (already supported by autosave).
- Add device-frame preview: small icon row (Monitor/Tablet/Smartphone) that just changes the visible canvas zoom-fit, separate from the actual artboard size, so creators can see how it looks on each device without changing the document.

## 4. Multi-page improvements

The data model already supports multi-page (`pages` table, `index`, `addPage`, `deletePage` exist). Improvements:

- Replace the cramped page chips in `TopBar` with a dedicated **Pages** panel on the left sidebar above `LayersPanel`:
  - Vertical list of page cards (small thumbnail placeholder, page name, index).
  - Click to select; double-click to rename.
  - Buttons per row: duplicate, delete (disabled if only 1).
  - Drag-and-drop to reorder (use existing `dnd-kit` if present, else simple up/down arrows).
- Add `duplicatePage(id)` and `reorderPages(orderedIds)` to `editorStore` (re-numbering `index`).
- Keep the `+ New page` button at the bottom of the panel.
- Top bar keeps a compact "Page X / Y" indicator + prev/next arrows.
- The **Navigate** action already supports `pageId`, so multi-page navigation works in viewer.

---

## Technical details

**Files to edit:**

- `src/store/editorStore.ts` — add `showHitboxes`, `toggleHitboxes`, `duplicatePage`, `reorderPages`, `setCanvasSize(w, h, mode)`, `cropCanvas(rect)`.
- `src/components/editor/Canvas.tsx` — hitbox overlay layer, crop overlay mode.
- `src/components/editor/ActionEditor.tsx` — convert to draft + Save/Discard buttons + validation.
- `src/components/editor/Inspector.tsx` — show "unsaved" dot on Action tab.
- `src/components/editor/TopBar.tsx` — hitbox toggle, device preset dropdown, device-frame icons.
- `src/components/editor/PagesPanel.tsx` — **new** component.
- `src/pages/Editor.tsx` — mount `PagesPanel` above `LayersPanel`.
- `src/pages/PublicViewer.tsx` — preview-only hitbox toggle.

**No DB migration required** — all new state lives in `flyers.settings` (size) or layer/page rows already supported.

**Crop math:** for a crop rect `{x, y, w, h}` in canvas coords:

- New `settings.width = w`, `settings.height = h`.
- For each layer: `position.x -= x`, `position.y -= y`.
- Drop layers where `position.x + size.width < 0` or `position.x > w` (similar for y).

**Hitbox overlay rendering:** add a second `<KLayer listening={false}>` after the main layer in `Canvas.tsx` that maps over layers with actions and draws a dashed `Rect` (purple, 2px) plus a small `Group` with a filled rounded rect + `Text` showing the action type.