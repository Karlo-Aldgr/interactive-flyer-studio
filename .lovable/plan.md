## Plan

1. **Rename the payment option for accuracy**
   - Change the checkout button from “Apple Cash (iMessage)” to “Open Messages for Apple Cash”.
   - Add an Apple-style wallet/message icon in the button so buyers recognize it as a payment step.

2. **Make the iPhone handoff more reliable**
   - Keep using current-window navigation for `sms:` links, because iOS often blocks `window.open` for Messages.
   - Format phone-number contacts as `sms:number?&body=...`.
   - If the seller entered an email address, route to `mailto:` instead of `sms:` because iMessage links to email addresses are not reliable from the browser.

3. **Fix the checkout text so expectations are clear**
   - Replace the current note that implies a clickable Apple Pay bubble will appear automatically.
   - Explain that iOS opens Messages with a prefilled note, and the buyer must tap the `+` / Apple Cash option inside Messages to send money.

4. **Update the seller-side test link too**
   - Fix the Apple Cash test button in payment settings to use the same iPhone-safe link format.
   - Make the test link navigate the current window for Messages instead of opening a blank tab.

## Important limitation

Apple does **not** provide a public web link that can directly open Apple Cash with a ready-to-pay clickable payment bubble. A website can only open Messages with the seller and note filled in; the buyer still has to choose Apple Cash inside iMessage.