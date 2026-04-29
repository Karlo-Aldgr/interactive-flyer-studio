# FlyerFlow Editor — Implementation Plan

The editor route currently renders a placeholder. This plan replaces it with a full Canva-style editing experience wired to the existing `flyers / pages / layers / actions` tables.

## Layout

Three-column shell inside `src/pages/Editor.tsx` using `ResizablePanelGroup`:

```text
┌────────────────────────────────────────────────────────────┐
│ TopBar: title, page tabs, undo/redo, Preview, Publish      │
├──────────┬───────────────────────────────────┬─────────────┤
│ Left     │                                   │ Right       │
│ Toolbar  │       Konva Canvas (Stage)        │ Inspector   │
│ + Layers │       + zoom / pan controls       │ Style /     │
│ panel    │                                   │ Action tabs │
└──────────┴───────────────────────────────────┴─────────────┘
```

## New files

- `src/store/editorStore.ts` — Zustand store: flyer, pages, selectedPageId, selectedLayerId, history stack (undo/redo), dirty flag, actions: addLayer, updateLayer, deleteLayer, reorderLayer, setBackground, addPage, deletePage, renamePage.
- `src/components/editor/TopBar.tsx` — title edit, page tabs, undo/redo, zoom, Preview button (opens `/f/:slug` in new tab), Publish toggle.
- `src/components/editor/Toolbar.tsx` — Add Text / Image (upload to `flyer-assets`) / Shape (rect, circle, line) / Icon (lucide picker) / Button.
- `src/components/editor/LayersPanel.tsx` — list with drag to reorder z-index, visibility, lock, delete.
- `src/components/editor/Canvas.tsx` — `react-konva` Stage + Layer; renders each `Layer` via a `LayerRenderer`; supports select, drag, transform (resize/rotate) via `Transformer`; arrow-key nudge; delete key.
- `src/components/editor/LayerRenderer.tsx` — switch on `layer.type` → `Text`, `KonvaImage` (with `useImage`), `Rect`/`Circle`/`Line`, icon (rendered to image via lucide SVG → dataURL), button (Rect + Text group).
- `src/components/editor/Inspector.tsx` — tabs: **Style** (fill, stroke, opacity, corner radius, shadow, font controls for text, src for image) and **Action** (type select + dynamic payload form).
- `src/components/editor/ActionEditor.tsx` — forms per `ActionType` (open_url, popup, video, call, sms, form, navigate to page, reveal target layers).
- `src/hooks/useFlyerData.ts` — load flyer + pages + layers + actions on mount; debounced autosave (1s) that diffs and upserts changed layers, deletes removed ones.
- `src/lib/konvaHelpers.ts` — id generation, default layer factories per type, clamp helpers.

## Data flow

1. On mount: fetch `flyer`, its `pages` (ordered by `index`), and all `layers` for those pages with their `action`. Hydrate Zustand store.
2. All edits mutate the store and push to a bounded history stack (50 entries) for undo/redo.
3. Autosave: a debounced effect watches the store; on change it upserts modified `layers` rows, inserts/updates `actions`, and updates the `flyers.updated_at` + `pages` if reordered.
4. Image uploads go to the existing `flyer-assets` bucket under `${user.id}/${flyerId}/...`; the public URL is stored on `layers.content.src`.
5. Publish toggle sets `flyers.status = 'published'` and ensures `public_slug` exists (generate slug if null).

## Interaction model

- Click empty canvas → deselect. Click layer → select; show Transformer.
- Drag to move; transformer handles to resize/rotate; snap to 8px grid with Shift.
- Double-click text layer → inline edit via overlaid `<textarea>` positioned over the Konva node.
- Right inspector reflects the selected layer; changes are immediate.
- Action tab: choose type → render matching form; saved into `actions` table linked to the layer.

## Out of scope for this pass (already planned for later)

- Public viewer rendering of the flyer + action execution.
- Analytics event capture and dashboard.
- QR code generation, templates gallery, team collaboration.

## Acceptance

- Can add/move/resize/rotate/delete elements of every type.
- Can add multiple pages, switch between them, reorder.
- Can attach any of the 8 action types to any layer and the data persists.
- Refreshing the editor restores the exact canvas state from the database.
- Undo/redo works across at least the last 50 operations.
