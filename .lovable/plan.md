# Photo-to-menu-page flow

Upload a menu photo → new page with the photo as background + clickable hotspots over each detected item → tap adds to a shared cart and opens the existing upsell modal. Existing list-style menu stays available.

## 1. Edge function `menu-scan`

Extend the tool schema so each item also returns a normalized bounding box (`x`, `y`, `w`, `h` in 0–1, relative to the image). Update the system prompt to ask the model to return the tight box around each item's row (name + price area). Keep the existing `sections`/`items` output; just add `bbox` per item.

## 2. New "Scan menu page" entrypoint

Add a button in `PagesPanel` ("📷 Add menu page from photo"):

- Uploads to `flyer-assets` under `${user.id}/${flyerId}/menu-scan/...`.
- Calls `menu-scan`, gets sections + per-item bboxes.
- Creates a new page (using `emptyPage` + insert into `pages`) sized to match the image aspect ratio (fit to flyer width).
- Inserts a full-page image layer (z=0) with the uploaded photo.
- For each detected item, inserts a `hotspot` layer positioned/sized from the bbox, with action:
  ```
  { type: "menu_add_item", payload: { item: { name, price, category, ... } } }
  ```
- Persists the scanned sections into the `menus` table tied to a single auto-created `show_menu` action on the flyer (so the upsell modal has the full catalog for "add a side / drink").
- Toasts "Added page with N tappable items".

To "scan page 2", the owner just clicks the same button again — each click creates a new page.

## 3. New action type `menu_add_item`

- Add `"menu_add_item"` to the `LayerAction` type union in `src/types/flyer.ts` with payload `{ item: MenuItem }`.
- Add the action-type enum value via migration (`alter type action_type add value 'menu_add_item'`).
- In `ActionEditor`, add a minimal editor (read-only item summary; not user-facing for scanned hotspots, but needed for type safety).

## 4. Shared cart (cross-page)

Create `src/store/menuCartStore.ts` (zustand):
```
{ items: CartLine[], add(item), remove(idx), clear(), open: bool, setOpen }
```

In `NewInteractionDialogs.tsx`:
- Refactor `MenuDialog` to source cart from the store instead of local state. The `show_menu` action opens it normally.
- Hotspot tap (`menu_add_item`) in the viewer handler: `add(item)`, then `setOpen(true)` jumping straight to the `upsell` step.
- A small floating cart pill ( `Cart · N · $X` ) renders in `PublicViewer` whenever `store.items.length > 0` and reopens the upsell modal on tap. This keeps the cart visible across page swipes.

## 5. Viewer wiring

In whichever component handles layer taps in the viewer (PublicViewer / FlyerPortalView), dispatch `menu_add_item` to call `cartStore.add(payload.item)` + open modal.

## Files touched

- `supabase/functions/menu-scan/index.ts` — add bbox to tool schema + prompt.
- `supabase/migrations/<new>.sql` — add `'menu_add_item'` to `action_type` enum.
- `src/types/flyer.ts` — extend `LayerAction` union.
- `src/components/editor/PagesPanel.tsx` — "Add menu page from photo" button + scan flow.
- `src/components/editor/ActionEditor.tsx` — minimal editor case for `menu_add_item`.
- `src/store/menuCartStore.ts` — new shared cart store.
- `src/components/viewer/NewInteractionDialogs.tsx` — `MenuDialog` uses shared store; jump to upsell step when cart already has items.
- `src/pages/PublicViewer.tsx` (+ `FlyerPortalView.tsx` if separate) — handle `menu_add_item` tap and render floating cart pill.

## Out of scope

- Drag-to-adjust hotspot boxes after scan (owners can still drag/resize via existing canvas tools — they're standard hotspot layers).
- Order/payment changes (existing checkout in `MenuDialog` is reused).
