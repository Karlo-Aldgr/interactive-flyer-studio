# Multi-select in the editor

Today the canvas can only hold one selected item at a time (`selectedLayerId`), so the transformer only ever grabs a single layer and every action — move, delete, duplicate, layer order — applies to one item. This adds true multi-select.

## What you'll be able to do

- **Shift-click / Ctrl-click** an item to add or remove it from the current selection.
- **Drag on empty canvas** to draw a marquee box; everything it touches gets selected (hold Shift to add to the existing selection).
- **Move the whole group** by dragging any selected item — everything moves together.
- **Resize/rotate the group** with one bounding box around all selected items.
- **Arrow keys** nudge the whole selection (Shift = 10px steps).
- **Bulk actions**: Delete, Duplicate, Bring to front / forward / backward / send to back for every selected item at once.
- **Align & distribute**: left / center / right / top / middle / bottom, plus distribute horizontally and vertically — shown in a small toolbar that only appears when 2+ items are selected.
- **Select all** (Cmd/Ctrl+A) and **Escape** to clear the selection.
- **Layers panel** highlights all selected items, and Shift-click there also extends the selection.
- **Inspector** shows a "N items selected" summary with the shared style controls (opacity, fill/color, alignment) and the bulk actions, instead of single-item fields.

Single-item behavior stays exactly as it is today, including hotspot drawing, crop mode, and object extraction — the marquee only activates when no drawing tool is armed.

## Technical notes

**Store (`src/store/editorStore.ts`)**
- Add `selectedLayerIds: string[]` as the source of truth; keep `selectedLayerId` as a derived getter/first-element so existing components keep working during rollout.
- New actions: `selectLayers(ids)`, `toggleLayerSelection(id)`, `clearSelection()`, `selectAllLayers()`, `updateLayers(ids, patchFn)`, `deleteLayers(ids)`, `duplicateLayers(ids)`, `moveLayersBy(ids, dx, dy)`, `orderLayers(ids, direction)`, `alignLayers(ids, mode)`, `distributeLayers(ids, axis)`.
- All bulk mutations commit a single history entry so one undo reverts the whole operation.

**Canvas (`src/components/editor/Canvas.tsx`)**
- Transformer gets `nodes(selectedLayerIds.map(id => nodeRefs[id]))`; keep rotation enabled and clamp min size as today.
- Marquee: on stage `mousedown` over empty space with no `drawMode`, track a rubber-band rect; on `mouseup`, hit-test layer bounding boxes (accounting for rotation via Konva `getClientRect`) and select intersections.
- Group drag: on `dragMove` of a selected node, apply the same delta to the other selected nodes; commit positions on `dragEnd` via `moveLayersBy`.
- Group transform: on `transformEnd`, read each node's absolute position/size/rotation and write back per layer, resetting scale to 1 (same pattern as the current single-layer path).
- Keyboard handler extended to operate over the selection array; add Cmd/Ctrl+A and Cmd/Ctrl+D (duplicate).

**UI**
- `LayersPanel.tsx`: highlight any id in the selection; Shift-click toggles.
- `Inspector.tsx`: new multi-select branch rendering count, shared style fields, align/distribute grid, and bulk order/delete/duplicate buttons.
- Floating selection toolbar above the canvas when `selectedLayerIds.length > 1`.

Works identically for flyer pages and digital business card pages, since both render through the same canvas and store.
