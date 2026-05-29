# Restaurant Operations Upgrade

A big set of related features. Grouping them into one coherent plan so the parts fit together.

## 1. Table numbers on every order

- Add `table_number` (text) and `order_type` (`dine_in` | `order_ahead`) to `menu_orders`.
- In the customer cart checkout (`NewInteractionDialogs.tsx`), require a Table Number field before "Place order". For "Order Ahead", table is optional but a pickup time is required and `requires_approval = true`.
- Mirror `table_number` and `order_type` into the matching `form_submissions.data` so the portal sees them too.

## 2. Waiter directory + table assignments (editable in portal)

New tables:
- `waiters` — per flyer: `name`, `pin` (4-digit, hashed), `color`, `active`.
- `table_assignments` — per flyer: `table_number`, `waiter_id`. Unique on (flyer, table).

Portal gets a new **"Staff & Tables"** tab where the owner can:
- Add / rename / deactivate waiters
- Type a table number and pick which waiter owns it
- Bulk-assign ranges (e.g. tables 1–10 → Maria)

## 3. Customer-facing waiter greeting

When a customer opens the cart on a published flyer:
- Lookup `table_number` → `table_assignments` → waiter name.
- Show a banner at the top of the cart: *"Your server tonight is **Maria** 👋"*.
- If table not assigned yet, fall back to "A server will be with you shortly."

## 4. Master Order Portal (owner)

New route inside the portal: **"Live Orders"** tab.
- Protected by a **master password** stored in `app_settings` per flyer (`master_pin_hash`). First visit prompts owner to set it; later visits prompt to enter it. Session-stored for 8h.
- Realtime board grouped by table, showing every active order across all waiters.
- Order-ahead rows rendered with a red border + red "Awaiting approval" badge; Approve / Reject buttons call an edge function that flips status.

## 5. Waiter Portal (per waiter)

Public-ish route `/w/:flyerToken` (reuses existing `portal_token`) where a waiter enters their PIN.
- After PIN verify (edge function), waiter sees only orders for tables assigned to them, realtime.
- Can mark items prepared / served / paid.
- Cannot see other waiters' tables or settings.

## 6. Daily 3 AM archive + recall

- Add `archived_at` to `menu_orders`. A `pg_cron` job at `0 3 * * *` (server time) sets `archived_at = now()` on all non-archived orders and clears active queues.
- Live views filter `archived_at IS NULL`.
- New **"Archive / Log"** sub-tab in portal: date picker → shows archived orders, with a "Recall" button that nulls `archived_at` and brings it back to the live board.
- This is what makes "the cart starts over each day" — the live board is just *today's* unarchived orders.

## 7. Order-ahead flow

- Customer toggle: "Dine in now" vs "Order ahead" (with pickup time).
- Order-ahead inserts with `status = 'pending_approval'`, highlighted red in master view.
- Manager (master portal) approves → status flips to `new` and waiter portal picks it up; reject → `cancelled` with reason.

---

## Technical notes

**Schema changes (migration):**
- `menu_orders`: add `table_number text`, `order_type text default 'dine_in'`, `archived_at timestamptz`, `pickup_at timestamptz`, `approved_by uuid`, index on `(flyer_id, archived_at)`.
- New `waiters`, `table_assignments` tables w/ GRANTs + RLS (owner full access; anon SELECT on `table_assignments` only — needed for greeting lookup).
- New `flyer_master_auth` (or reuse `app_settings`) for hashed master PIN per flyer.
- `pg_cron` + `pg_net` extensions, cron job `archive_menu_orders_daily` at 03:00.

**Edge functions:**
- `waiter-auth` — verify waiter PIN, return short-lived JWT scoped to flyer + waiter_id.
- `master-auth` — verify master PIN for a flyer, return short-lived token.
- `approve-order` — manager-only, flips `pending_approval` → `new`.

**Frontend:**
- `src/components/viewer/NewInteractionDialogs.tsx` — table input, order-ahead toggle, waiter greeting banner.
- `src/components/portal/StaffTablesPanel.tsx` (new) — waiters & assignments CRUD.
- `src/components/portal/LiveOrdersBoard.tsx` (new) — realtime master view.
- `src/components/portal/OrdersArchivePanel.tsx` (new) — date picker + recall.
- `src/pages/WaiterPortal.tsx` (new) + route `/w/:token`.
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE menu_orders, table_assignments;`

**Out of scope (ask if you want these too):**
- SMS/email notifications to waiters on new orders.
- Printer / KDS integration.
- Splitting checks across tables.

---

This is ~5–7 medium-sized changes. I'll build it in order: schema → portal staff/tables → cart (table + greeting + order-ahead) → master live board → waiter portal → archive + cron. Want me to proceed end-to-end, or ship it in stages so you can test each piece?