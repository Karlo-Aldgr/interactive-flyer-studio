## Goal
Fix the carousel viewer so cards are correctly sized and vertically centered, and add editor options for text above/below the carousel plus a background color.

## New payload fields (src/types/flyer.ts)
Add to the carousel section of the action payload:
- `carouselHeadline?: string` — text above the carousel
- `carouselSubtext?: string` — text below the carousel
- `carouselBgColor?: string` — background behind the carousel (default `#111111`)
- `carouselTextColor?: string` — color for the header/footer text (default `#ffffff`)
- `carouselCardRatio?: "9:16" | "4:5" | "1:1"` — card aspect ratio (default `9:16`)

No database change is needed — these live inside the existing JSON payload.

## Viewer (src/components/viewer/CarouselDialog.tsx)
- Apply `carouselBgColor` as the overlay background instead of the fixed `bg-black/95`.
- Vertically center the scroller: the track becomes a centered flex row inside a full-height container, so the row of cards sits in the middle of the screen with the headline above and subtext below.
- Card sizing: each card gets a fixed aspect ratio (from `carouselCardRatio`) and a height capped to the available viewport (`max-h`), width derived from the ratio, so the video and flyer cards all match the reference proportions instead of stretching. Media uses `object-contain` for flyers so nothing is cropped, video keeps `object-cover` option.
- Render `carouselHeadline` above the track (centered, display font) and `carouselSubtext` below it, both using `carouselTextColor`.
- Keep the close button, dots, arrows, mute and CTA behavior as-is.

## Editor (src/components/editor/ActionEditor.tsx, CarouselEditor)
Add controls under the existing title/direction/start-slide fields:
- Headline (text above) and Subtext (text below) inputs
- Background color and text color pickers
- Card aspect ratio select (9:16 / 4:5 / 1:1)
Include the new fields in the existing copy/paste carousel JSON.

## Technical notes
- Colors here are user-chosen per-flyer content values, so they stay inline styles on the viewer (same pattern as the existing slide CTA colors), not design tokens.
- Horizontal mode keeps snap scrolling with peeking neighbor cards as in the reference photo; vertical mode keeps one centered card per screen.
