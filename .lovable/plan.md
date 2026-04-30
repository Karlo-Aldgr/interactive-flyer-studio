# Flyer Intro Animations

Let creators choose an intro animation that plays the first time a viewer lands on a page (and optionally per-layer stagger). Plays in both the editor preview and public viewer.

## What you'll get

In the editor, a new **Intro Animation** section (Page settings panel) with:

- **Preset**: None, Fade, Slide Up, Slide Down, Slide Left, Slide Right, Zoom In, Pop, Blur In, Drop
- **Duration**: 200–2000ms slider (default 600ms)
- **Delay**: 0–2000ms slider (default 0)
- **Stagger layers**: toggle — when on, layers animate in sequence (sorted by z-index) using a per-layer offset (default 80ms)
- **Replay** button (editor only) to preview again
- **Apply to all pages** button

In the public viewer:
- Animation plays once per page when first shown (page load + on `navigate` action between pages).
- Respects `prefers-reduced-motion` (skips to final state).

## Where it lives

- Stored on `FlyerPage` as a new optional `intro` field (JSON in existing `pages.background` sibling — actually a new `intro` jsonb column on `pages`, since `background` is its own thing).
- Type:
  ```ts
  interface PageIntro {
    preset: "none" | "fade" | "slide-up" | "slide-down" | "slide-left" | "slide-right" | "zoom" | "pop" | "blur" | "drop";
    durationMs?: number;   // default 600
    delayMs?: number;      // default 0
    stagger?: boolean;     // default false
    staggerStepMs?: number;// default 80
  }
  ```

## Editor UX

- New collapsible section in `PagesPanel.tsx` (or a new `PageSettings` block in the right inspector when no layer is selected) titled "Intro animation".
- Selecting a preset immediately replays the animation in the canvas so the creator sees it.
- "Apply to all pages" copies the current page's intro to every page.

## Viewer behavior

- On page mount / page change, wrap each Konva layer's `<Group>` in a tween:
  - Fade: opacity 0 → 1
  - Slide-*: offset translate (e.g. 40px) → 0 + opacity
  - Zoom: scale 0.9 → 1 + opacity
  - Pop: scale 0.6 → 1.05 → 1 (overshoot easing) + opacity
  - Blur: CSS-style blur not native to Konva — emulate with opacity + slight scale (cheap fallback)
  - Drop: y offset -60 → 0 with ease-out-bounce-ish easing
- Implemented with Konva's built-in `Tween` (or React state + `requestAnimationFrame`) on each `Group`. No new deps.
- `prefers-reduced-motion: reduce` → instantly show final state, log no animation.

## Technical details

**DB migration**
- Add `intro jsonb` column to `pages` (nullable, default null).

**Types (`src/types/flyer.ts`)**
- Add `PageIntro` interface above.
- Extend `FlyerPage` with `intro?: PageIntro`.

**Hook (`src/hooks/useFlyerData.ts`)**
- Read/write the `intro` column alongside `background`.
- Map row → `FlyerPage.intro`.

**Editor**
- `src/components/editor/PagesPanel.tsx` (or new `src/components/editor/PageIntroEditor.tsx`):
  - Preset Select, Duration Slider, Delay Slider, Stagger Switch, Replay button, Apply-to-all button.
  - Calls `updatePage(pageId, { intro: { ... } })` via the existing store.
- `src/components/editor/Canvas.tsx`:
  - Track `introKey` state that bumps when the active page's `intro` changes or Replay is pressed.
  - Wrap each layer `<Group>` with an `<IntroAnimatedGroup>` that applies the preset tween based on `intro`, `introKey`, and the layer's stagger index.
- New file `src/components/editor/IntroAnimatedGroup.tsx`: Reusable Konva group wrapper that applies a preset to its children using Konva `Tween` on mount. Used by both Canvas and PublicViewer.

**Viewer (`src/pages/PublicViewer.tsx`)**
- Reuse `IntroAnimatedGroup` to wrap each rendered layer (replacing the `Group` in `renderLayer`).
- Bump intro key on `pageIndex` change so animations replay between pages.
- Respect `window.matchMedia("(prefers-reduced-motion: reduce)").matches`.

**Defaults / back-compat**
- If `intro` is null → preset = "none" → no animation, identical to today.

## Out of scope

- Per-layer custom animations (only the page-level preset + optional stagger).
- Exit animations on page leave.
- Looping/idle animations (separate from intro).
- Real Gaussian blur in Konva (would need filters; we use opacity+scale fallback).
