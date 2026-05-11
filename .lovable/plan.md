# Appointments Action

A new action type viewers can tap on a flyer to book a time. Owners configure availability, viewers pick a slot (or any date/time), and the viewer gets a branded confirmation email with a calendar invite. Each flyer has its own dedicated portal where the owner sees and manages its appointments.

## What the viewer sees

A new action `Book appointment` appears in the Action Editor alongside the existing actions. When tapped on a published flyer, it opens a full calendar dialog:

- **Slot mode**: shows only the open time slots the owner defined. Booked slots are hidden/disabled.
- **Free-pick mode**: full month calendar; viewer picks any date and any time.

Then a short form: name, email, optional phone, optional note. After submit:
- Confirmation screen with date/time + "Add to Google Calendar" button + "Download .ics" button.
- Confirmation email sent automatically with the .ics attached and a Google Calendar link inside.

## What the owner configures (Action Editor)

For each Appointment action:
- Mode: **Slots** or **Free pick**
- Appointment title, location (optional), description (optional)
- Duration (15 / 30 / 45 / 60 / 90 / custom min)
- Timezone (defaults to flyer owner's browser tz)
- Buffer between appointments (slot mode)
- Availability rules (slot mode): weekday on/off + start/end time per day, plus blackout dates
- Date range the calendar is bookable (e.g. next 30 days)
- Max bookings per day (optional)
- Fields to collect (name always; email always; phone optional/required; note optional)
- Confirmation email subject + custom intro text
- Success message shown after booking

## Per-flyer back-office portal

Each flyer gets its own portal page (route: `/flyer/:flyerId/portal`) opened from a new "Portal" button in the editor TopBar. The portal aggregates everything collected through that flyer's actions, with tabs:

- **Appointments** — calendar view (month/week/day) + list view, filter by status (upcoming / past / cancelled). Click an appointment for details, mark cancelled, copy contact, export CSV.
- **Subscribers** — moves the existing SubscribersPanel here.
- **Form submissions** — list of generic form action submissions for this flyer.
- **Poll results** — per-poll vote counts.
- **Cart / payment intents** — list of buy_product / cart events for this flyer.

Only the flyer owner (and admins) can open the portal. Search across name/email/phone, CSV export per tab.

## Database

New table `appointments`:
- `flyer_id`, `layer_id`, `action_id`
- `name`, `email`, `phone`, `note`
- `start_at`, `end_at`, `timezone`
- `status` enum: `confirmed | cancelled`
- `metadata` jsonb (custom fields)
- standard `id`, `created_at`, `updated_at`

RLS:
- `INSERT` allowed for `anon` + `authenticated` when the parent flyer is published.
- `SELECT` for the flyer owner and for admins (`has_role(auth.uid(),'admin')`).
- `UPDATE` (cancel) for the flyer owner and admins.

Index on `(flyer_id, start_at)` for fast portal queries.

The action config itself lives in the existing `actions.payload` jsonb — no schema change there. New `ActionPayload` fields: `apptMode`, `apptDurationMin`, `apptTimezone`, `apptBufferMin`, `apptWeeklyAvailability`, `apptBlackoutDates`, `apptDateRangeDays`, `apptMaxPerDay`, `apptCollectPhone`, `apptPhoneRequired`, `apptCollectNote`, `apptConfirmSubject`, `apptConfirmIntro`, `apptSuccessMessage`, `apptTitle`, `apptLocation`, `apptDescription`.

## Email (Lovable Cloud)

Uses the built-in Lovable Email infrastructure (no third-party service):
1. Set up email domain (dialog) if not already configured.
2. Set up email infrastructure (queues, suppression, unsubscribe) — automatic.
3. Scaffold transactional email Edge Function.
4. Add a new template `appointment-confirmation.tsx` rendering: greeting, appointment title, formatted date/time + timezone, location, description, "Add to Google Calendar" button, brand colors pulled from `index.css`.
5. New Edge Function `book-appointment` (called from the public viewer):
   - Validates input (zod), checks the slot is still free in slot-mode, inserts the row in `appointments`, builds the .ics, then invokes `send-transactional-email` with the `appointment-confirmation` template, the recipient email, an `idempotencyKey` derived from the appointment id, and `templateData` for the dynamic fields. The .ics file is delivered via a download link (Lovable email infra does not support attachments) — the email contains a "Download .ics" button pointing at a signed URL stored in `flyer-assets`.

## Frontend pieces

- `src/types/flyer.ts` — extend `ActionType` with `"book_appointment"` and add the new payload fields.
- `src/components/editor/ActionEditor.tsx` — new editor section for the Appointment action (mode, duration, availability grid, fields, email copy).
- `src/components/editor/AppointmentAvailabilityEditor.tsx` *(new)* — weekly grid + blackout dates picker.
- `src/pages/PublicViewer.tsx` — handle the new action: open `AppointmentBookingDialog`.
- `src/components/viewer/AppointmentBookingDialog.tsx` *(new)* — calendar (`react-day-picker` already used by `ui/calendar.tsx`) + time-slot list + form + success screen.
- `src/lib/appointmentSlots.ts` *(new)* — pure helpers: generate slots from availability rules, subtract booked slots, format times in tz.
- `src/lib/calendarHelpers.ts` — reuse `buildIcs` and `buildGoogleCalendarUrl` (already in repo) for the success screen and email link.
- `src/components/editor/TopBar.tsx` — add "Portal" button linking to `/flyer/:flyerId/portal`.
- `src/pages/FlyerPortal.tsx` *(new)* — tabbed portal (Appointments calendar + list, Subscribers, Form submissions, Polls, Cart events).
- `src/components/portal/AppointmentsCalendar.tsx` *(new)* — month/week/day calendar built on `react-day-picker` for month + custom week/day grid.
- `src/App.tsx` — register `/flyer/:flyerId/portal` inside `ProtectedRoute`.

## Backend pieces

- Migration: create `appointments` table + enum + RLS + index.
- Edge Function `book-appointment` — public, no JWT (verify_jwt = false).
- Email infra: `setup_email_infra` + `scaffold_transactional_email` + new `appointment-confirmation` template, then deploy.

## Out of scope (can be added later)

- Owner-side notifications (you chose viewer-only emails).
- Rescheduling by the viewer (only cancel-by-owner in v1).
- Recurring appointments / multiple staff calendars.
- Payment-on-booking (can wire to existing `buy_product` flow later).
