## Goal
Reduce perceived load time and runtime lag across the app — especially on the landing page, dashboard, and public viewer.

## What I'll change

### 1. Smaller initial JavaScript bundle
- Split vendor chunks in `vite.config.ts` so big libraries (Konva/react-konva, Recharts, Supabase, Radix UI, lucide-react) become separate cached files instead of one giant bundle.
- Confirm heavy routes already lazy-load (`App.tsx` already does ✅) and lazy-load remaining heavy components inside routes (e.g. `Canvas`, chart panels, `NovelReaderDialog`, `AppointmentBookingDialog`) so they don't load until used.
- Replace any broad `import * as LucideIcons` patterns with direct imports where reasonable to enable tree-shaking.

### 2. Faster landing page
- Defer the `ParallaxBackground` scroll listener work on low-power devices (already respects reduced-motion; add visibility/passive guard).
- Lazy-load the `PhoneDemoMockup` video below the fold (`loading="lazy"`, `preload="metadata"`, `poster` attr) so the LCP isn't blocked by video bytes.
- Add `fetchpriority="high"` + `<link rel="preload">` for the true LCP image, and `loading="lazy"` + width/height on all other images to stop layout shift.

### 3. Snappier React rendering
- Add a global `QueryClient` config with `staleTime` (e.g. 60s) so React Query stops refetching on every focus/mount, which currently causes spinner flashes.
- Memoize a couple of hot lists (Layers panel, Pages panel) where re-render churn is visible.

### 4. Network / asset hygiene
- Add `<link rel="preconnect">` for the Supabase domain in `index.html` to shave TLS time off the first DB call.
- Verify images served from Supabase storage request `?width=` transforms where supported, and add `decoding="async"` to large `<img>` tags.

### 5. Verify
- After changes: build, then run a Playwright pass against the landing page and `/dashboard` to capture screenshots and confirm nothing visually regressed, and read console for new warnings.

## Out of scope
- No backend / schema changes.
- No design or copy changes.
- No new dependencies (the optimizations use existing tooling).

## Technical notes
- `vite.config.ts` will get a `build.rollupOptions.output.manualChunks` block.
- `QueryClient` lives in `src/App.tsx` — config goes there.
- Index HTML edits are scoped to `<head>` preload/preconnect hints only.

## Question before I start
Do you want me to also enable route-level prefetching on hover (e.g. dashboard → editor prefetches the editor bundle when the user hovers a flyer card)? It costs a tiny bit of bandwidth but makes navigation feel instant. Default: yes.
