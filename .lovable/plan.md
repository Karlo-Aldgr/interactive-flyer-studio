# Plan: Force mobile view on public flyer viewer

## Goal
On `/f/:slug` (PublicViewer), the flyer should always render in a mobile-width frame — regardless of whether the viewer is on phone, tablet, or desktop. Today it stretches edge-to-edge to `window.innerWidth`, which makes flyers huge on desktop.

## Scope
Public viewer route only. Editor canvas, admin previews, and dashboards are untouched.

## Change

In `src/pages/PublicViewer.tsx` (around line 1795–1830), cap the effective viewport width used for scale calculation to a mobile maximum (440px). The stage wrapper already uses `margin: "0 auto"`, so the flyer becomes a centered mobile-width column with neutral gutters on larger screens.

Specifically:
- Add `const MOBILE_MAX_W = 440;`
- Replace `const vw = window.innerWidth` with `const vw = Math.min(window.innerWidth, MOBILE_MAX_W);`
- Leave `vh` as-is (full viewport height still used for fit scaling).
- The outer `<div className="min-h-screen ...">` keeps the page background color filling the screen; the centered inner stage wrapper provides the mobile frame.
- `previewMode` floating banner and other overlays remain unchanged.

No changes to:
- Flyer data, settings.width/height, or stored dimensions
- Editor canvas sizing
- `enlargedScale` behavior (pinch / tap-to-enlarge still works within the mobile column)
- Any backend / schema

## Verification
- Open a published flyer on desktop → flyer renders as a centered mobile-width column.
- Open the same flyer on a phone → unchanged (window width already ≤ 440).
- Editor and admin previews unaffected.
