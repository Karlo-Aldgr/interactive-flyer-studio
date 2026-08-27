# Font picker in the editor

Right now text and button layers in the editor have size, weight, align, colour and opacity — but no way to change the typeface. Everything renders in Plus Jakarta Sans, the only font the app loads.

## What gets added

A **Font** dropdown at the top of the Text section (and the Button section) in the right-hand Inspector, showing each font name previewed in its own typeface. Picking a font applies it to the selected layer(s) immediately on canvas and in the published flyer/website/business card.

## Font list (curated, all free Google Fonts)

Sans: Plus Jakarta Sans (default), Inter, Poppins, Montserrat, Roboto, Open Sans, Lato, Raleway, Oswald, Bebas Neue, Anton
Serif: Playfair Display, Merriweather, Lora, Georgia
Display / script: Pacifico, Lobster, Great Vibes, Permanent Marker
Mono: Courier New

## Technical notes

- New `src/lib/fontOptions.ts` exporting the curated list (family name + CSS stack + Google Fonts spec), reused by the Inspector, the existing Social slideout font list, and the business-card dialog so all font pickers stay in sync.
- Load the fonts via a single Google Fonts `<link>` in `index.html` with `display=swap` and the weights the editor exposes (300–800 where available), so no extra runtime fetch logic is needed.
- Inspector: add a `Select` bound to `layer.style.fontFamily` via `updateLayerStyle`, for both the text and button branches; each option is rendered with its own `fontFamily` for a live preview. Applies to all selected layers when multi-select is active.
- Canvas (Konva) caches text metrics before webfonts finish loading, so add a one-time `document.fonts.ready` listener in the Canvas that forces a redraw, preventing wrong glyph widths on first paint.
- Viewer/website/bizad renderers already read `layer.style.fontFamily`, so no changes needed there beyond the font files being loaded.
- Existing layers keep their current look (fallback stays Plus Jakarta Sans).
