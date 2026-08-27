# Add Condensed Fonts (Oswald, Bebas Neue, Barlow Condensed) to Editor

## Goal
Make the fonts from the user's reference image available everywhere fonts can be chosen in the app.

## Changes

1. **`src/lib/fontOptions.ts`** — add three entries:
   - `Oswald` (Sans / condensed)
   - `Bebas Neue` (Display / condensed uppercase)
   - `Barlow Condensed` (Sans / condensed)
   Each with the correct CSS `font-family` stack and label so the existing `FontSelect` dropdowns (Text, Button, and Multi-select panels in `Inspector.tsx`) pick them up automatically — no Inspector changes needed.

2. **`index.html`** — extend the existing Google Fonts preload link to include:
   - `Oswald:wght@400;500;600;700`
   - `Bebas+Neue` (400 only — single weight font)
   - `Barlow+Condensed:wght@400;500;600;700`

3. **Verify** — the `SocialMediaDialog.tsx` font list already syncs from the shared `fontOptions.ts` registry, so it inherits the new fonts with no change. The `document.fonts.ready` redraw in `Canvas.tsx` already ensures correct Konva text metrics once the new webfonts load.

## Verification
- Build passes.
- New fonts appear in the Inspector font dropdown and render correctly on the editor canvas and in flyer preview.

## Technical notes
- No database or backend changes.
- No new UI components — fonts flow through the existing shared registry pattern.
