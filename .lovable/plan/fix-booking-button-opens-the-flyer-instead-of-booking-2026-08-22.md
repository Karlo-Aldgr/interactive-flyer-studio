# Fix: Booking button opens the flyer instead of booking

## What's happening

On the digital business card viewer, the action dispatcher handles a set of action types (call, text, email/link, video, audio, popup, gallery, carousel, coupon, calendar, map, checkout). `book_appointment` is not one of them, so it falls into the catch-all branch, which opens the live flyer link so a tap never dead-ends. That's why the BOOKING button shows the flyer.

Other booking-adjacent action types are in the same catch-all: form, poll, menu order, novel, chatbot, etc. This plan fixes booking now and notes the rest.

## The fix

Wire the real appointment booking flow into the business card viewer:

- Add a `book_appointment` case to the card's action dispatcher that opens the existing `AppointmentBookingDialog` (the same component the flyer viewer uses) instead of falling through to the flyer link.
- Pass the card's `flyer_id`, the tapped layer id, and the action so bookings are stored against the same flyer and appear in the flyer portal's Appointments list exactly like flyer bookings.
- Keep everything else in the dispatcher unchanged.

## Technical notes

- File: `src/components/viewer/BizadLayoutView.tsx`
- Add an `appointment` dialog state alongside the existing `popup` / `gallery` / `carousel` / `coupon` states, set it in a new `case "book_appointment"`, and render `AppointmentBookingDialog` with `flyerId={bizad.flyer_id}`.
- No database, edge function, or business-logic changes; `book-appointment` already handles the write and confirmation email.

## Not included unless you want it

The other unsupported action types (form, poll, menu order, chatbot, novel) will still open the live flyer. Say the word and they can be brought over the same way.

I WANT ALL ACTIONS THAT APPLIES TO FLYERS TO WORK WITH DIGITAL BUSINESS CARDS, 