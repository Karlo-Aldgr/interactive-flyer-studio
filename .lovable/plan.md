## Goal

A new interactive action, **Carousel** — a multi-view scrolling gallery. Slide 1 is a video, slides 2+ are flyer images with title/subtitle, each slide can have its own CTA button and its own tap action. Any button/hotspot/image on any of your 4+ flyers can open it. It is not a page, so it never shows in page navigation.

## Editor experience

New action type `carousel` appears in the action picker under **Media & content** (next to Photo gallery).

Editor panel fields:
- Carousel title (optional header)
- Scroll direction: **Horizontal cards** (default, like your example) or **Vertical feed** — your choice per carousel
- Start on slide N (so different flyers can open the same carousel at different slides)
- Slide list (add / reorder / delete, up to ~20):
  - Type: **Video** or **Image**
  - Media: upload or paste URL (video upload reuses existing flyer-asset upload)
  - Title + subtitle text
  - CTA button: label, color, and an action (WhatsApp/URL, call, SMS, navigate to page, popup)
  - Tap action on the media itself (optional, same action picker)
  - Video options: autoplay muted, loop, show mute toggle

## Viewer experience

Fullscreen overlay matching your reference:
- Horizontal mode: snap-scrolling card rail, swipe on mobile, prev/next arrow buttons on desktop, dot indicators
- Vertical mode: stacked full-width cards, snap scroll
- Each card: media on top (video card autoplays muted with a mute/unmute icon), title + subtitle below, CTA pill button at the bottom right of the card
- Only the card in view plays video; others pause. Off-screen images lazy-load
- Close button; existing viewer auto-advance/page-nav is paused while it's open (same as other overlays)

## Linking the 4+ flyers

Each flyer gets a button or hotspot with the Carousel action. To reuse the same content across flyers, the editor panel gets **Copy carousel JSON / Paste carousel JSON** so you configure it once and paste into the other flyers, optionally changing only "Start on slide".

## Technical notes

- `src/types/flyer.ts`: add `"carousel"` to `ActionType`, add `CarouselSlide` interface and payload fields (`carouselTitle`, `carouselDirection`, `carouselStartIndex`, `carouselSlides`)
- `src/lib/actionCategories.ts` + `src/lib/interactionsCatalog.ts`: register the action with an icon and description
- `src/components/editor/ActionEditor.tsx`: new `CarouselEditor` sub-component + validity check (valid when ≥1 slide has media)
- New `src/components/viewer/CarouselDialog.tsx` for the overlay
- `src/pages/PublicViewer.tsx`: new `carousel` state, `case "carousel"` in the action dispatcher, render the dialog, include it in the overlay-blocking lists
- No database or migration changes — it all lives in the existing action payload JSON
