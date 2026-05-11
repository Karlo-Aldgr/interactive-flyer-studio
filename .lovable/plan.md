## Goal

Make every clickable area on the published flyer broadcast a continuous **pulsing signal** so end users immediately know what's tappable. Also add a subtle highlight flash in the portal hotspot activity log when a row is opened.

## What exists today

`PulseHighlight` in `src/pages/PublicViewer.tsx` already draws a stroked outline that fades opacity / thickens stroke. It's a single static ring — easy to miss, especially on busy flyer art.

## What changes

### 1. Public viewer — radar-style pulsing signal

In `src/pages/PublicViewer.tsx`, upgrade the existing `PulseHighlight` so the default `style: "pulse"` renders a **continuously expanding signal ring** (radar ping) on top of the existing outline:

- Keep the static outline (rect / ellipse / circle) so the shape of the hotspot is always visible.
- Add 1–2 extra stroked rings driven by `Konva.Animation` that:
  - Start at the hotspot's bounds with full opacity.
  - Scale outward ~25% larger over ~1.6s.
  - Fade opacity to 0 as they expand.
  - Loop forever, with the second ring offset by half a period for a continuous "ping… ping…" feel.
- Respect existing per-action `highlight` settings (color, thickness, opacity, enabled, style). If `style` is `corners` / `circle` / `dashed` / `solid` / `glow`, leave current behavior; only `pulse` (the default) gets the new radar effect.
- Honor the global `flyer.settings.highlightsEnabled` toggle — already wired.

### 2. Click feedback burst

When a hotspot is actually tapped, fire a one-shot expanding ring from the click point (separate from the looping signal) so the user gets immediate confirmation. Hook into the existing click handler that calls `logClick` / `executeAction` and push a short-lived ring into a local state array; render it in the same Konva overlay layer and remove it when the animation finishes (~600ms).

### 3. Portal hotspot activity log — row highlight

In `src/pages/FlyerPortal.tsx`, when a user clicks a row in the hotspot activity dialog (or opens the dialog for a layer), briefly flash the row/header with a soft accent background + ring, using existing tokens (`bg-accent`, `ring-primary/40`) and Tailwind's `animate-pulse` for ~1s, then settle. No business-logic changes.

## Technical notes

- All animation lives in `PublicViewer.tsx` (`PulseHighlight` component + a new `ClickPing` component) and `FlyerPortal.tsx` (CSS class toggle via `useState` + `setTimeout`).
- Uses Konva's existing `Konva.Animation` loop — no new dependencies.
- Colors come from each action's `highlight.color` (default `#7c3aed`, matches `--primary`).
- No DB / schema / analytics changes. Pay-later flow, device tracking, and existing pulse settings are untouched.

## Files touched

- `src/pages/PublicViewer.tsx` — extend `PulseHighlight`, add `ClickPing` overlay + click handler wiring.
- `src/pages/FlyerPortal.tsx` — flash highlight on activity row open.