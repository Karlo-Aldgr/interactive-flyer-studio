## Status of analytics capture

I tested directly against the database and confirmed:
- Your flyer **"Stop Repeating"** is `published` ✅
- The RLS policy correctly allows anonymous visitors to insert `view`, `click`, etc. events ✅
- A manual test insert from the anon key succeeded ✅
- But there are **0 events** stored for this flyer, meaning your QR-code visit never reached the tracking call

Likely causes: the page was served from a stale cache (the QR loaded before tracking was added), the network blocked the insert silently (we never log the response), or the page never finished loading. The pipeline itself works — we just have no visibility when it fails.

## Plan

### 1. Make analytics tracking reliable + observable
- In `PublicViewer.tsx`, await the view-event insert and log any error to the console + send a beacon retry on `pagehide` so the event isn't lost when a visitor closes the tab quickly.
- Same hardening for `logClick`.
- Add a small "Refresh" button on the portal Analytics tab so you can re-pull after a test visit without reloading.

### 2. Cart orders → clickable with full detail dialog
In `FlyerPortal.tsx` cart tab:
- Each row becomes a button that opens a dialog showing: customer (name/email/phone/address), itemized list with qty + price, subtotal/total, currency, payment method, timestamp, raw notes.
- Add a status badge on each row + status selector inside the dialog with four states:
  - **New** (default for orders with no status yet) — highlighted with primary accent
  - **Completed** — green
  - **On Hold** — amber
  - **Pay Later** — blue
- Status changes persist to the database and update the row immediately.
- Counters at the top of the cart tab: New · On Hold · Pay Later · Completed.

### 3. Storage for order status
`form_submissions` currently has no status column and no UPDATE policy. Migration:
- Add nullable `status text` column to `form_submissions` (values: `new | on_hold | pay_later | completed`).
- Add an `owner updates submissions` RLS policy so the flyer owner can set/change status.
- Default existing cart orders to `new` (computed in UI when null).

### Files touched
- `supabase/migrations/<new>.sql` — add column + update policy
- `src/pages/FlyerPortal.tsx` — cart dialog, status badges/selector, counters, refresh
- `src/pages/PublicViewer.tsx` — awaited inserts, error logging, pagehide beacon

### Out of scope
- No design-system changes; existing badge variants reused
- No changes to PublicFlyerPortal (visitor portal) or edge function

After the migration runs, your next QR visit will be captured, and any cart order will be a tappable card you can move through New → On Hold / Pay Later → Completed.