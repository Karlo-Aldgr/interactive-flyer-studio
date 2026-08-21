# Digital business card as a real editor page

When the Digital business card is enabled for a flyer, the editor gets a new page named "Digital business card" in the Pages panel — pre-filled from onboarding data, fully editable like any other page. Edits to that page are saved and become what visitors see at the public `/bizads/:slug` link.

## Behavior

- Toggling "Add bizad to this flyer" on in the Digital business card dialog creates the page (once) and selects it.
- The page is built from the card data: logo image, business name and owner name text, about text, flyer thumbnail, and tappable buttons (Call, Text, Email, Directions, Save contact, View flyer, Website/Facebook/Instagram), colored with the card's button/background colors.
- Everything on the page is a normal layer — move, restyle, retype, add or delete elements, change page background.
- The page is editor-only: viewers never swipe to it inside the flyer. It is skipped in the public viewer, in page counting/navigation, and in thumbnail generation.
- Turning the toggle off keeps the page but marks it hidden (greyed in the Pages list, public card returns "not found"); turning it back on restores it.
- Deleting the page manually is still allowed; re-enabling recreates a fresh one from card data.

## What visitors see

The public `/bizads/:slug` page renders the saved editor page layout when one exists, at the page's own canvas size, scaled to fit the phone screen. Buttons keep their actions (tel:, sms:, mailto:, maps, vCard download, flyer link, socials). If no editor page exists yet, the existing default card template renders as it does today.

## Technical notes

- Page marker: add `bizadPage?: boolean` and `bizadHidden?: boolean` to `FlyerPage.background` (jsonb — no schema change for pages). Used to filter the page out of the viewer and to find/update it.
- New store action `addBizadPage(bizad)` in `src/store/editorStore.ts`, modeled on `addScannedMenuPage`, generating image/text/button-hotspot layers with existing action types (`phone`, `sms`, `email`, `link`).
- `BizadDialog.tsx`: on enable, call the store action if no bizad page exists; on disable, set `bizadHidden`.
- `PagesPanel.tsx`: label the page with a card icon, show a "hidden" state, exclude it from the numbered flyer-page count (same treatment as landing pages).
- `PublicViewer.tsx` / any page-list consumers: filter out pages where `background.bizadPage` is true.
- Migration: add a `layout jsonb` column to `bizads` storing the page's layers plus canvas size and background, written whenever the flyer saves and a bizad page is present. `PublicBizad.tsx` gets a lightweight static renderer for that layout, falling back to the current template.
- Onboarding data continues to be the source for the initial fill via `buildBizadPayloadFromOnboarding`.
- No changes to Meta or affiliate code.
