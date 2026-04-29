# Multi-Step Interactions + Action Presets

Add a true multi-step interaction model (tap → popup → next action) and ship four ready-made presets that build on it: Buy Ticket, RSVP, Link to Checkout, and Coupon (with unlock).

## What you'll get

1. **Popups can chain into a next action.** Inside any popup you can add 1+ buttons. Each button triggers another action (open URL, video, calendar, form, navigate, reveal, call/sms, download image, or another popup).
2. **Buy Ticket preset.** Pops up showing an uploaded ticket image plus a "Buy now" button that opens a checkout URL. Optional "Save ticket" button downloads the ticket image.
3. **RSVP preset.** Pops up an RSVP form (name + email, optional phone) with a success message and optional "Add to calendar" button afterward.
4. **Link to Checkout preset.** One-tap open-URL action with a checkout-styled label, optional "Confirm before opening" popup step.
5. **Coupon preset.** Pops up a coupon image + code. Two modes:
   - **Show coupon** — reveal image and code immediately.
   - **Unlock with code** — viewer types a code; on match, reveal coupon image, code, and a copy-to-clipboard button. Optional "Redeem" button opens a URL.

Coupon images and ticket images upload to existing `flyer-assets` storage (same flow as the Image tool).

## Editor UX (Inspector → Action panel)

The Action type dropdown gets a new **Presets** group at the top:

- Buy ticket
- RSVP
- Link to checkout
- Coupon

Picking a preset fills the right fields and shows only what's relevant (e.g. ticket image upload, checkout URL, RSVP fields, coupon code + image + unlock toggle).

For the existing **Show popup** action, a new "Buttons" section appears under Title/Body/Image:

- Add button → label + nested action editor (recursive, max depth 2 to keep things sane)
- Reorder / delete buttons
- Each button uses the same Save action lock-in flow

The hitbox overlay badge will show the preset name (e.g. "Coupon", "RSVP") instead of the raw type when present.

## Viewer behavior

- Popup dialog renders the title, body, optional image, then a vertical stack of buttons. Tapping a button runs its action — chaining popups, opening URLs, downloading images, submitting forms, etc. — without closing context unexpectedly.
- Buy Ticket: dialog shows ticket image + "Buy now" → opens checkout URL in new tab. Analytics logs `click` with `action_type: buy_ticket`.
- RSVP: dialog shows form fields, submits to existing `form_submissions` table with `metadata.preset = "rsvp"`, then optionally chains into Add to Calendar.
- Coupon (show): dialog shows image + code with a "Copy code" button.
- Coupon (unlock): dialog shows a code input. On match, swap to the revealed view (image + code + copy + optional Redeem button). Wrong codes show an inline error. Code comparison is case-insensitive and trimmed.

All new actions log analytics `click` events the same way existing ones do, with the preset name in metadata.

## Technical details

**Types (`src/types/flyer.ts`)**

- Extend `ActionType` with: `"buy_ticket" | "rsvp" | "checkout" | "coupon"`.
- Extend `ActionPayload` with:
  - `buttons?: Array<{ id: string; label: string; action: LayerAction; style?: "primary" | "secondary" }>` (used by `popup`, `buy_ticket`, `coupon`)
  - `ticketImageUrl?: string`, `checkoutUrl?: string`
  - `couponImageUrl?: string`, `couponCode?: string`, `couponUnlock?: boolean`, `couponUnlockCode?: string`, `couponRedeemUrl?: string`
  - `rsvpFields?: Array<"name" | "email" | "phone">`, `rsvpAddToCalendar?: boolean` (reuses existing calendar payload fields)

No DB migration needed — `actions.payload` is already JSON, and `flyer-assets` bucket already exists.

**ActionEditor (`src/components/editor/ActionEditor.tsx`)**

- Add preset group to the type select.
- Add `<PopupButtonsEditor>` subcomponent for editing the `buttons` array. Each row reuses `ActionEditor` recursively (with a `depth` prop, hard-capped at 2 to disable nested popups beyond one level).
- Add an `<AssetUpload>` helper that wraps the existing Toolbar upload pattern (`supabase.storage.from("flyer-assets").upload(...)`) so it's reusable from coupon/ticket panels.
- Update `isValid()` for the new presets:
  - `buy_ticket`: requires `ticketImageUrl` or `checkoutUrl`
  - `rsvp`: requires at least one field
  - `checkout`: requires `checkoutUrl`
  - `coupon`: requires `couponImageUrl` or `couponCode`; if `couponUnlock`, requires `couponUnlockCode`

**Viewer (`src/pages/PublicViewer.tsx`)**

- Generalize the popup state to hold a stack so chained popups can replace each other cleanly.
- Add `runAction` cases for `buy_ticket`, `rsvp`, `checkout`, `coupon`.
- New `<CouponDialog>` component handles both show and unlock modes with local input state and clipboard copy via `navigator.clipboard.writeText`.
- Popup dialog renders `payload.buttons` as a vertical button stack; each button click calls `runAction` with a synthetic layer (so analytics/chaining work).

**Hitbox overlay**

- Update the badge label map in `Canvas.tsx` and `PublicViewer.tsx` to include the new presets.

## Out of scope

- Real payment processing (Buy Ticket / Checkout just open the URL you provide; Stripe/Paddle hookup is a separate task).
- Per-user coupon code generation (single shared code per coupon for now).
- Email confirmations for RSVP (submissions land in the existing form submissions table; you can wire email later).
