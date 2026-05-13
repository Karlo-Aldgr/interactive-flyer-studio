## Goal

Allow a single flyer to contain pages of different sizes — specifically a 1200×630 "landing" page that links into the normal-sized flyer pages via the existing `navigate` action. Today every page in a flyer shares one width/height (`flyer.settings.width/height`). We'll add an optional per-page size override.

## What changes

### 1. Data model (no DB migration needed)
The `pages.background` column is already a free-form `jsonb`. To avoid a schema change, we store the override under `pages.background.size`:

```ts
background: { color?: string; image?: string; size?: { width: number; height: number } }
```

If `background.size` is missing, fall back to `flyer.settings.width/height` (current behavior — no impact on existing flyers).

Update `FlyerPage`/`background` type in `src/types/flyer.ts` accordingly.

### 2. Editor store (`src/store/editorStore.ts`)
- Add `setPageSize(pageId, w, h, mode: ResizeMode)` — same scale/resize/crop logic as the existing `setCanvasSize`, but applied to a single page's layers and stored on `page.background.size`.
- Add `addLandingPage(width=1200, height=630)` helper that creates a new page with the override pre-set and a sensible default name ("Landing").

### 3. Canvas (`src/components/editor/Canvas.tsx`)
Replace:
```ts
const W = flyer.settings.width;
const H = flyer.settings.height;
```
with a per-page resolver:
```ts
const W = page.background.size?.width ?? flyer.settings.width;
const H = page.background.size?.height ?? flyer.settings.height;
```
So the stage, background rect, and crop math all use the active page's size. Existing pages keep working because the override is undefined.

### 4. Pages panel (`src/components/editor/PagesPanel.tsx`)
- Add an "Add landing page (1200×630)" item to the `+` button (split into a small dropdown: "Add page" / "Add landing page").
- For the active page, add a "Page size" section with width/height inputs, a "resize / scale / crop" mode selector, and quick presets (Flyer default, 1200×630 landing, 1080×1080, 1080×1920). Wired to `setPageSize`.

### 5. Public viewer (`src/pages/PublicViewer.tsx`)
Same per-page size resolver as the canvas: when rendering each page, use `page.background.size` if set, else fall back to flyer settings. The Stage width/height, background, and fit-to-screen scaling already key off a single W/H per render — just compute it per active page.

### 6. Linking landing → flyer
The `navigate` action already supports `pageId` targeting any other page in the flyer (`ActionPayload.pageId`). No new action needed: on the 1200×630 landing page, the user adds a button/hotspot and picks "Navigate → Page X" to jump into the full-size flyer pages.

## Out of scope
- No database migration (re-using existing `pages.background` jsonb).
- No changes to thumbnail/OG generation logic — first page still drives the share image, which works whether it's the landing or a flyer page (user choice via page order).
- Sharing/worker code is untouched.

## Technical notes
- `cropCanvas`, `setCanvasSize`, and the crop overlay currently mutate `flyer.settings` globally. We keep those as the "flyer default size" controls (used by pages without an override) and add the new per-page equivalents. Pages with an override are skipped by the global resize.
- Layers continue to live in absolute page coordinates, so per-page sizes don't affect each other.
