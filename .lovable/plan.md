## Realtor Portal — Access Paths

Add four distinct entry points so realtors (and admins) can reach `/realtor` without typing the URL.

### 1. Admin direct link (quick win)
- **Admin sidebar nav**: Add a "Realtor Portal" item in `AdminLayout` / admin navigation (next to Users, Jobs, Editors, Mini-ads), pointing to `/realtor`.
- **Admin header button**: Add a "Realtor view" button in the admin header, mirroring the existing "Customer view" button. Uses `?view=realtor` or a direct `/realtor` link.
- **Editors page shortcut**: On `AdminEditors.tsx`, next to each granted realtor row, add an "Open as realtor" link (admin-only) for QA/support.

### 2. Customer Portal cross-link
- Add a **"Realtor Portal"** entry in `CustomerPortalSidebar` that is conditionally rendered **only** when the signed-in user already has the `realtor` role (checked via existing role hook).
- For customers **without** the realtor role, show a small promo card on the Customer Portal Overview: *"Are you a real estate agent? Apply for a Realtor account →"* linking to the public sign-up flow (path 3).

### 3. Public realtor sign-up / application flow
A new route `/realtor/apply` (public) so anyone can request realtor access.

- **Form fields**: name, email, brokerage, license #, phone, website (optional), short message.
- **Backend**: new `realtor_applications` table (status: pending/approved/rejected, reviewed_by, reviewed_at). RLS: applicant can insert; admins can read/update.
- **Flow**:
  1. User submits form → row inserted with `status=pending`.
  2. If they don't have an account yet, prompt them to sign up (standard auth flow) using the same email.
  3. Admin sees pending applications in a new **Admin → Realtor Applications** page (`/admin/realtor-applications`) — approve grants the `realtor` role automatically and redirects user on next login; reject sends a polite decline.
- **Email notifications** (optional, uses existing email infra): confirmation to applicant, alert to admin, approval/rejection email.
- **Landing entry points** to the application:
  - Footer link "For Realtors" on the marketing site.
  - Dedicated marketing section/page `/for-realtors` with feature highlights + CTA to `/realtor/apply`.

### 4. Direct deep-link from auth
- Update `Auth.tsx` post-login routing: users with the `realtor` role go to `/realtor` (already done); add support for `?next=/realtor` so marketing CTAs can deep-link through sign-in.
- After signup completion on `/realtor/apply`, if approved later, the next sign-in lands them directly on `/realtor`.

---

### Files touched (high level)
- `src/components/admin/AdminLayout.tsx` (or equivalent nav) — admin nav + header button.
- `src/components/customer/CustomerPortalSidebar.tsx` — conditional realtor link.
- `src/pages/admin/AdminEditors.tsx` — per-row "Open as realtor".
- `src/pages/RealtorApply.tsx` (new) — public application form.
- `src/pages/admin/AdminRealtorApplications.tsx` (new) — review queue.
- `src/pages/ForRealtors.tsx` (new, optional marketing page).
- `src/App.tsx` — register new routes.
- Marketing footer component — "For Realtors" link.
- Migration: `realtor_applications` table + RLS + GRANTs + admin approve RPC that grants the `realtor` role.

### Open questions before building
1. Should realtor applications be **auto-approved** (anyone who applies gets the role immediately), or **admin-reviewed** (recommended, default in this plan)?
2. Do you want a **public marketing page** `/for-realtors` now, or just the bare `/realtor/apply` form?
3. Should approval/rejection trigger **emails** to the applicant?
4. Which of the four paths should I build **first** — the admin direct link (fastest), or the full public sign-up flow?
