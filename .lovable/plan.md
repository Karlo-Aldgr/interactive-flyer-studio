## Goal
Reduce initial JS payload so the preview loads noticeably faster. Today every route (Landing, Auth, Dashboard, Editor with Konva, Analytics with Recharts, PublicViewer) is statically imported in `src/App.tsx`, so visitors download all of it upfront — including `konva` + `react-konva` (~300KB) and `recharts` even when they only open the Landing page.

## Changes

### 1. Lazy-load route components (`src/App.tsx`)
Replace static imports with `React.lazy` + a single `<Suspense>` fallback around `<Routes>`. Keep `Landing` eager so the first paint of the home page stays instant; lazy-load Auth, Dashboard, Editor, Analytics, PublicViewer, NotFound.

```tsx
const Editor = lazy(() => import("./pages/Editor"));
const Analytics = lazy(() => import("./pages/Analytics"));
// ...
<Suspense fallback={<FullScreenSpinner />}>
  <Routes>...</Routes>
</Suspense>
```

This alone splits the giant Konva/Recharts chunks out of the initial bundle.

### 2. Manual vendor chunking (`vite.config.ts`)
Add `build.rollupOptions.output.manualChunks` to isolate large libs so they cache well and don't bloat the entry chunk:
- `konva`, `react-konva`, `use-image` → `konva` chunk
- `recharts` → `charts` chunk
- `@radix-ui/*` → `radix` chunk
- `react`, `react-dom`, `react-router-dom` → `react` chunk

### 3. Font loading
Add `media="print" onload="this.media='all'"` pattern (or `rel="preload" as="style"`) to the Google Fonts `<link>` in `index.html` so fonts don't block first paint.

### 4. Spinner fallback
Small reusable `<FullScreenSpinner/>` (just the existing `Loader2` centered) used by Suspense, so route transitions show the same spinner pattern already used inside `Editor`.

## Out of scope
- No changes to data-loading logic in `useFlyerData`.
- No design/visual changes.
- No dependency upgrades or removals.

## Files to edit
- `src/App.tsx` — lazy routes + Suspense
- `vite.config.ts` — manualChunks
- `index.html` — non-blocking font load

## Expected impact
Initial JS for `/` and `/auth` drops significantly (Konva + Recharts no longer loaded). Editor route loads its own chunk on demand, but TTI on first visit improves.
