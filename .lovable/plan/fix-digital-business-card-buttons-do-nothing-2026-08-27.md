# Fix: digital business card buttons do nothing

## What I found (verified against the live data)

The card viewer only makes a tile tappable when that layer has a saved action. Checking the database:

- GOD'S WARRIOR card: 18 layers, **0 saved actions** — every tile (CALL, TEXT/SMS, EMAIL, FACEBOOK, WEBSITE, BOOK, SAVE CONTACT, SHARE) is dead. Its published card copy also has zero actions.
- The other four cards (Vontastic's, Express T-shirts, Hands On Concierge, Inspire Therapy) have only 4–8 actions across 8–15 layers: CALL / TEXT / EMAIL / FLYER / BOOKING are wired, but **SAVE CONTACT, SHARE, WEBSITE and FACEBOOK tiles have no action at all** on every card.

So this is a data problem (buttons were never linked, and one card lost all of its links), not a broken click handler.

## The fix

1. **Built-in behavior for standard card tiles.** In the card viewer, when a tile has no saved action, fall back to its known role based on the button label and the card record:
   - SAVE CONTACT → download vCard
   - SHARE → native share sheet / copy card link
   - CALL, TEXT/SMS, EMAIL → the card's phone / email
   - WEBSITE, FACEBOOK, INSTAGRAM, TIKTOK → the matching social link on the card
   - FLYER / GALLERY → the card's flyer link
   - BOOK → the booking dialog
   If the card has no value for that tile (e.g. no website saved), the tile stays visibly inert instead of pretending to work.

2. **Templates create linked buttons.** When a card is generated from a template, attach these same actions up front using the onboarding/card data, so new cards ship with working tiles.

3. **"Repair links" action in the editor.** A one-click control on the business-card page that regenerates the standard tile actions from the current card record (phone, email, website, socials, flyer URL) — this is what recovers GOD'S WARRIOR and fills the missing WEBSITE / SAVE CONTACT / SHARE links on the existing cards.

4. **Restore GOD'S WARRIOR now.** Run that same repair on its saved layers and republish the card copy so it works immediately.

5. **Verify** in the preview browser: open each published card and confirm the tiles fire (call/sms/mailto links present, vCard downloads, share sheet opens, website opens).

## Technical notes

- Viewer: `src/components/viewer/BizadLayoutView.tsx` — add a label-to-action resolver used by `LayerView`/`runAction` when `layer.action` is null; keeps existing saved actions authoritative.
- Templates: `src/lib/bizadTemplates/*` (`cleanActionGrid`, `gradientProfile`, `vontastic`) plus `kit.ts` helpers — pass real actions into the standard tiles.
- Editor repair control: `src/components/editor/PagesPanel.tsx` (next to "Center layout"), writing through the existing store save path so `actions` rows and the published `bizads.layout` copy both update via `syncBizadRecordFromEditorPage`.
- Data repair for GOD'S WARRIOR: insert the missing `actions` rows for its business-card layers and refresh its `bizads.layout` snapshot.
