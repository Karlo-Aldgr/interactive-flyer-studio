# Show every flyer as a full job card in Admin Jobs

Today the "All flyers" section at the bottom of `/admin/jobs` renders a thin row with only Open and Delete. Of the 40 flyers in the system, 38 have no linked job record, so they get none of the job options (status, editor, mini-ad, Manage).

## What changes

1. **Every flyer gets a job.** Backfill a job row for each flyer that doesn't have one, and auto-create a job whenever a new flyer is created going forward. The job title and owner come from the flyer, type `design`, status `new` (flyers already published start as `delivered`).
2. **"All flyers" section restyled.** It stays as its own section below the jobs list, but each flyer now renders with the exact same card as the jobs list: NEW badge, status badge, editor badge, type badge, owner email and dates, brief, action chips, price / pay link / upload, Open editor link, Manage button, delete, and the Mini-ad banner checkbox.
3. **Same actions everywhere.** Manage opens the same job dialog; the mini-ad checkbox uses the same admin RPC; delete on a flyer card removes the flyer (with its existing confirm dialog), and Manage/status changes act on the linked job.

## Technical notes

- Migration:
  - Backfill: insert a `jobs` row for each `flyers` row with no `jobs.flyer_id` match (`user_id` = flyer owner, `customer_email` from `profiles`, `title` = flyer title, `type` = 'design', status mapped from flyer status).
  - Trigger `AFTER INSERT ON public.flyers` that creates the matching job when one doesn't exist.
- `src/pages/AdminJobs.tsx`: extract the current job card JSX into a local `JobCard` component and reuse it for both the jobs list and the flyer section, keyed by the flyer's linked job. Flyer rows with no job (shouldn't occur after backfill) fall back to the current simple row.
