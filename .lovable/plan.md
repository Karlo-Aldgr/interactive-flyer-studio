# Pending Sale Details

Add a "Pending sale" info prompt that appears when a realtor (owner) or admin clicks a listing card whose market status is **Pending**.

## Data model

New table `public.listing_pending_details` (one row per flyer):

- `flyer_id` (uuid, PK, FK → `flyers.id` on delete cascade)
- `seller_name`, `buyer_name`, `buyer_agent_name`, `buyer_agent_brokerage`
- `agreed_price_cents` (bigint)
- `earnest_money_cents`, `closing_costs_cents` (bigint)
- `contract_date`, `inspection_deadline`, `financing_deadline`, `closing_date` (date)
- `title_company`, `lender`
- `contingencies` (text)
- `notes` (text)
- `created_at`, `updated_at`

RLS: owner of the parent flyer OR admin can select/insert/update/delete. Nobody else. GRANTs to `authenticated` + `service_role` only (no anon).

Trigger to auto-update `updated_at`.

## Backend

Add two RPCs (SECURITY DEFINER, guard by owner-or-admin):

- `get_listing_pending_details(_flyer_id uuid) → jsonb` — returns the row plus the base listing fields (address, listed price, beds/baths/sqft, listing_status) so the dialog is a single fetch.
- `upsert_listing_pending_details(_flyer_id uuid, _payload jsonb) → jsonb` — insert or update.

## Frontend

**`ListingCard.tsx`** — when `listing.listing_status === "pending"`, make the thumbnail/title area clickable (`role="button"`, keyboard-accessible). Non-pending cards are unchanged. Buttons (Edit/Photos/Publish/Duplicate/Open/Delete) keep their own click handlers with `stopPropagation`. Add a small "View pending details" affordance on hover.

**New `src/components/realtor/PendingSaleDetailsDialog.tsx`**
- Header: address + Pending badge
- Read-only "Listing information" summary block: address, listed price, beds/baths/sqft, market status
- "Sale information" form (edit-in-place, save button):
  - Seller name, Buyer name, Buyer's agent + brokerage
  - Agreed purchase price, Earnest money, Closing costs
  - Contract date, Inspection deadline, Financing deadline, **Closing date**
  - Title company, Lender
  - Contingencies (textarea), Notes (textarea)
- Save calls `upsert_listing_pending_details`, toasts, closes.
- Admins can view/edit; owner realtor can view/edit; anyone else gets a permission error surfaced as toast (but they can't reach it because the card click gate is role-based via existing `RealtorDashboard` context, which only owners/admins see anyway).

**`RealtorDashboard.tsx`** — wires the dialog: track `pendingDetailsFor: Listing | null`, render `<PendingSaleDetailsDialog>` and pass the open handler down to `ListingCard`.

**`src/lib/realtor.ts`** — add typed helpers `loadPendingDetails(flyerId)` and `savePendingDetails(flyerId, payload)` around the two RPCs.

## Out of scope

- No changes to the public realtor profile / public flyer view — pending-sale details stay private to the owner and admins.
- No changes to non-pending listing cards' click behavior.

## Technical notes

- Money stored as cents (bigint) to match existing `price_cents` convention.
- All new columns nullable so an empty form can be saved progressively.
- Dialog uses existing shadcn `Dialog`, `Input`, `Textarea`, `Label`, `Button`; date fields use `<Input type="date">` to stay consistent with the rest of the realtor forms.
