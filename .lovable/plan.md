
# Per-flyer payment checkout (Venmo / Cash App / Apple Cash)

Goal: each flyer stores its own set of payment handles. When a viewer checks out from the cart, they pick a method and are sent to that app with the order total pre-filled.

## Quick note on Apple Pay
There is no public "Apple Pay" deep link to send money to an arbitrary person — Apple Cash transfers happen inside iMessage. The realistic implementation is **Apple Cash via iMessage**: store the creator's iMessage phone/email, open `sms:` on the buyer's device, and Apple Cash appears as a button in Messages on iPhone. The UI will label this "Apple Cash (iMessage)" so expectations are clear.

## 1. Per-flyer payment settings (no DB migration)
Reuse `flyer.settings` (existing jsonb). Add three optional fields:

- `payVenmo?: string` — Venmo username (no @)
- `payCashapp?: string` — $Cashtag (no $)
- `payApplePayContact?: string` — phone or email registered with Apple Cash

This keeps every flyer independent. Existing flyers stay untouched.

## 2. Editor: "Payment methods" dialog
Add a new `FlyerPaymentSettingsDialog` opened from a button in the editor's `TopBar` (next to Share). The dialog shows three inputs (Venmo, Cash App, Apple Cash contact) plus a per-row "Test" button that opens a sample link. Saves to `flyer.settings` via existing `setFlyer` + autosave.

A small inline banner appears in the buy_product editor whenever `productCartEnabled` is on, reminding the user that cart checkout requires at least one payment method to be configured.

## 3. PublicViewer: payment picker after Place Order
The current checkout form already collects name/email/phone/address/notes. After the user clicks **Place order**:

1. Validate the form (existing logic).
2. Save the order to `form_submissions` with `kind: "cart_order"`, items, customer, total, currency, and the chosen payment method.
3. Show a small **Pay with…** screen inside the same dialog listing only the methods configured on this flyer:
   - Venmo → `https://venmo.com/?txn=pay&recipients={handle}&amount={total}&note={flyerTitle} order`
   - Cash App → `https://cash.app/${handle}/{total}`
   - Apple Cash → `sms:{contact}&body=Sending {currency}{total} for {flyerTitle} order`
4. Each button opens the link in a new tab/scheme handler. The cart is cleared after the user opens any of them; a "Done" button closes the dialog.

If no payment methods are configured, show a clear message: "This seller hasn't set up payments yet — your order has been recorded and they'll contact you to arrange payment." (Order is still saved.)

## 4. Order data
Stored row in `form_submissions.data`:
```
{
  kind: "cart_order",
  customer: { name, email, phone, address, notes },
  items: [...],
  total, currency,
  payment_method: "venmo" | "cashapp" | "applecash" | "manual",
  submitted_at
}
```
The owner sees these in the existing Subscribers / Submissions panel.

## Files touched
- `src/types/flyer.ts` — add the three optional fields to `FlyerSettings`.
- `src/components/editor/FlyerPaymentSettingsDialog.tsx` — new file.
- `src/components/editor/TopBar.tsx` — add a button to open the dialog.
- `src/components/editor/ActionEditor.tsx` — small reminder under the cart toggle.
- `src/pages/PublicViewer.tsx` — extend the checkout dialog with the payment picker and link builders; pull settings off `flyer.settings`.

## Out of scope
- No Stripe/Apple Pay merchant integration (that needs a real payment processor + webhooks).
- No automatic payment confirmation — Venmo/Cash App/Apple Cash are person-to-person transfers; the seller verifies receipt manually.
