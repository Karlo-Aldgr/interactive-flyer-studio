## Plan

1. **Fix the Apple Cash link format**
   - Change the checkout Apple Cash URL from `sms:number&body=...` to the iPhone-safe format `sms:number?&body=...`.
   - Keep current-window navigation for `sms:` links so iOS can open Messages instead of a blank tab.

2. **Add a mobile fallback**
   - If the seller’s Apple Cash contact is stored as an email instead of a phone number, use `mailto:` because iOS Messages may not open `sms:` with an email recipient reliably.
   - Keep phone-number contacts using `sms:`.

3. **Preserve order/payment logging**
   - Do not change the checkout form, cart, product details, or saved order behavior.
   - Only update the Apple Cash launch behavior after the order is placed.

## Expected result

On iPhone, tapping **Apple Cash (iMessage)** should open Messages with the seller as the recipient and the order total/note prefilled, so the buyer can tap Apple Cash inside iMessage to send payment.