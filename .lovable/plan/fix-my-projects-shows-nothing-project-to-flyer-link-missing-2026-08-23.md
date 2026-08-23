# Fix: My projects shows nothing (project-to-flyer link missing)

## What's actually wrong
The page request to the database is failing outright, so the list falls back to "You haven't submitted any projects yet." The error returned for your account was:

`Could not find a relationship between 'jobs' and 'flyers'`

The projects table stores the flyer it belongs to, but there is no declared link between the two tables, so the data API refuses the combined query. Your account (showoffgrafixs@gmail.com) does have 40 projects and 39 flyers stored — none deleted — so nothing is missing, the read just errors out. This has been failing for both the old and new versions of the page, which is why the grouping and check buttons never appeared.

## Fix

1. **Database**: declare the missing link between projects and flyers (projects reference the flyer they belong to; clearing a deleted flyer leaves the project intact). Verified there are no broken references, so the link can be added safely.
2. **Page hardening** in `src/pages/MyJobs.tsx`:
   - Surface load failures instead of silently showing the empty state: if the read fails, show an error card with a Retry button and a toast, so this never again looks like "no projects".
   - Fall back to a plain projects read (no flyer join) plus a separate flyer lookup if the combined query ever fails again.
3. **Verify** by loading `/my-jobs` in the running app as the signed-in owner and confirming the "Ready to share" section lists the paid/completed projects with working check buttons and that "Post to Socials" enables on selection.

## Technical notes
- Migration: `ALTER TABLE public.jobs ADD CONSTRAINT jobs_flyer_id_fkey FOREIGN KEY (flyer_id) REFERENCES public.flyers(id) ON DELETE SET NULL;` — this also makes PostgREST's `flyer:flyers(...)` and `flyers!inner` embeds resolve.
- No change to RLS beyond the policy already added (users can see projects for flyers they own).
- Keep the existing grouping/selection work from the previous plan; only the data load and error handling change.
