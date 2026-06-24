# Role switcher for the customer portal

Make the customer portal reachable from admin and editor sessions without losing their normal landing pages.

## Changes

### 1. `/dashboard?view=customer` renders the customer portal for everyone
`src/pages/Dashboard.tsx`:
- Read a new `view` search param. When `view === "customer"`, skip the admin redirect and the `canEdit` editor branch, and always render the `CustomerPortalShell` + `CustomerDashboard` (using the existing `loadUserJobs` flow that already runs for non-editors — extend its effect so it also runs when `view === "customer"`).
- Existing `studio=1` admin escape hatch stays as-is.

### 2. "Customer view" link in admin nav
`src/components/admin/AdminNav.tsx`:
- Add a second secondary link right after the existing "Editor studio" button, in both the `menu` variant and the `bar/drawer` variant:
  - Label: "Customer view"
  - Target: `/dashboard?view=customer`

### 3. "Customer view" link in editor header
`src/components/dashboard/DashboardShell.tsx`:
- Add a small "Customer view" button next to the user email / sign-out for editors (always visible — harmless for admins who already get it via `AdminNav`). Same target: `/dashboard?view=customer`.

### 4. Back-to-your-area link inside the portal
`src/components/portal-customer/CustomerPortalShell.tsx`:
- When `useIsAdmin()` or `useCanEdit()` reports the viewer has those roles, show a "Back to admin" or "Back to editor" link in the header (right side, before sign-out). Pure presentation.

No schema, no RLS, no business-logic changes. The portal already renders fine for any signed-in user because `loadUserJobs` is scoped by `user.id`; admins/editors with no jobs will simply see the empty state.

## Out of scope
- No new route. `/dashboard?view=customer` is the single entry point.
- No persisted "preferred view" — switching is per-click.
