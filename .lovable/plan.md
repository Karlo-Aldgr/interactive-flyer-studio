## Mini-Ad Add-On for Flyers

A sticky bottom banner (like the BIGGS / VET4SUCCESS reference image) shown on the public viewer. Admin manages a pool of ads; the banner only appears on flyers where the add-on is enabled (either paid via job billing or toggled on by admin).

### 1. Database (one migration)

**`mini_ads` table** — the ad inventory managed by admin.
- `image_url` (text), `click_url` (text), `alt_text` (text)
- `active` (bool, default true)
- `weight` (int, default 1) — for weighted random rotation
- `starts_at`, `ends_at` (nullable timestamptz)
- standard id/created_at/updated_at
- RLS: anon/auth `SELECT` where `active = true` and within date window; admin full manage. Grants for anon (read), authenticated, service_role.

**Extend `jobs` table** with mini-ad add-on flags:
- `mini_ad_enabled` (bool, default false) — admin toggle / set true when paid
- `mini_ad_paid` (bool, default false) — set by billing flow
- (no schema change to `flyers`; we derive enablement by joining the flyer's job)

**Helper view/function** `flyer_mini_ad_enabled(_flyer_id uuid)` → bool, SECURITY DEFINER, returns true if the flyer's job has `mini_ad_enabled = true`. Used by the public viewer (anonymous) without exposing the full jobs row.

**`mini_ad_events` table** — impressions & clicks.
- `mini_ad_id` (fk), `flyer_id` (fk), `event_type` ('impression'|'click'), `session_id` (text), `created_at`
- RLS: anon `INSERT` allowed; `SELECT` only for admin and flyer owner. Grants accordingly.

### 2. Admin Portal

New page **`/admin/mini-ads`** (added to AdminNav):
- Table of ads with image preview, click URL, active toggle, weight, schedule, edit/delete.
- "New ad" dialog — upload image to `flyer-assets` bucket, fill URL + alt + schedule.
- Stats column: total impressions, total clicks, CTR (aggregated from `mini_ad_events`).

In **`AdminJobs.tsx`** — add a "Mini-Ad" toggle on each job card (calls a new RPC `admin_set_job_mini_ad(_job_id, _enabled)`). Shows current state.

### 3. Job billing add-on

In **`JobBillingActivationPanel.tsx`** — add a checkbox "Add mini-ad banner (+$X)" alongside the existing sharing activation. On checkout/activation, set `mini_ad_enabled = true` and `mini_ad_paid = true`. Price is a constant for now (e.g., $5) — wired into the existing payment flow without new payment infra.

### 4. Public viewer (`PublicViewer.tsx`)

- On mount, call `flyer_mini_ad_enabled(flyerId)`. If false → render nothing.
- If true → fetch one active ad via a weighted random pick (RPC `pick_mini_ad()` returning a single row from `mini_ads` filtered by active + date window).
- New component **`MiniAdBanner.tsx`**:
  - Fixed bottom, full width, ~80px tall on mobile / ~96px on desktop, above any other floating buttons.
  - `<a href={click_url} target="_blank" rel="noopener sponsored">` wrapping the image.
  - Small "Ad" pill label in the corner (transparency / compliance).
  - Logs an `impression` event on first render (debounced per session_id+ad_id), and a `click` event on click — both insert into `mini_ad_events` directly via the anon client.
- Adjusts viewer bottom padding so the banner doesn't cover content / existing floating "Your order" button (re-position that button above the ad when present).

### 5. Flyer portal stats

In **`FlyerPortalView.tsx`** — add a small "Mini-Ad performance" card (only when add-on is enabled) showing impressions, clicks, CTR for this flyer, pulled via the portal-access edge function (extend it to aggregate `mini_ad_events` for the flyer).

### Files touched

- New migration (mini_ads, mini_ad_events, jobs columns, helper functions, RLS, grants)
- New: `src/pages/AdminMiniAds.tsx`, `src/components/viewer/MiniAdBanner.tsx`
- Edited: `src/components/admin/AdminNav.tsx`, `src/pages/AdminJobs.tsx`, `src/components/dashboard/JobBillingActivationPanel.tsx`, `src/pages/PublicViewer.tsx`, `src/components/portal/` (new stats card), `src/components/portal/FlyerPortalView.tsx`, `supabase/functions/portal-access/index.ts`, `src/App.tsx` (route)

### Out of scope (can do later)

- Per-flyer custom ads (only admin network for now, as chosen)
- Multiple rotating ads per page view (one ad per session for now)
- Geographic / category targeting
