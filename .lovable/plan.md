# Customer Portal Shell

Bring `/dashboard` (customer view), `/my-jobs`, `/my-jobs/:jobId`, `/my-jobs/:jobId/edit`, and `/submit-job` under a single shell with consistent navigation. Editor/admin dashboards are left untouched.

## What gets built

### 1. New `CustomerPortalShell` (`src/components/portal-customer/CustomerPortalShell.tsx`)
Wraps customer pages with:
- Top header: logo, user email, sign-out (reusing existing patterns from `DashboardShell`).
- Collapsible shadcn sidebar (`collapsible="icon"`) with `SidebarTrigger` in the header so it works on mobile + desktop.
- Sidebar nav items, active route highlighted via `NavLink`:
  - Overview → `/dashboard`
  - My projects → `/my-jobs`
  - New project → `/submit-job`
  - Examples → `/examples`
- Content area renders children inside a centered container (mirrors `DashboardPage` widths).

### 2. New `CustomerPortalSidebar` (`src/components/portal-customer/CustomerPortalSidebar.tsx`)
Implements the shadcn `Sidebar` pattern from the sidebar knowledge: `NavLink` + `useLocation` for active state, icon-only when collapsed, `SidebarMenu` items for the four routes above.

### 3. Page wiring
Swap shells in the customer-facing routes to use `CustomerPortalShell`:
- `src/pages/Dashboard.tsx` — only for the customer branch (`!canEdit && !isAdmin`); editor/admin keep `DashboardShell`. Done by branching at render time.
- `src/pages/MyJobs.tsx` — replace its bespoke header with `CustomerPortalShell`.
- `src/pages/JobDetail.tsx` — replace `DashboardShell` with `CustomerPortalShell`.
- `src/pages/EditJob.tsx` — replace `DashboardShell` with `CustomerPortalShell`.
- `src/pages/SubmitJob.tsx` — wrap in `CustomerPortalShell` (currently uses its own logo header — remove that).

No business logic, no data fetching, no schema changes. Pure presentation/navigation refactor.

## Out of scope
- No changes to editor (`EditorDashboard`) or admin areas.
- No route renames (URLs stay the same so existing links keep working).
- No changes to flyer owner portal (`/flyer/:flyerId/portal`, `/p/:token`) — that's a separate operational surface.

## Technical notes
- Uses existing `@/components/ui/sidebar` (`SidebarProvider`, `Sidebar`, `SidebarTrigger`, etc.).
- Shell layout: `SidebarProvider` wraps a `flex w-full` container; sidebar on the left, main column has its own sticky header containing `SidebarTrigger` + user controls.
- Mobile: sidebar uses offcanvas behavior automatically via shadcn; trigger stays in header.
- Active route detection: `pathname.startsWith(item.url)` for `/my-jobs` so detail/edit pages keep that item highlighted.
