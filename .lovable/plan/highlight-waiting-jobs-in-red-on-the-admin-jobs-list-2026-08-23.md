# Highlight waiting jobs in red on the Admin Jobs list

## Goal
Make jobs that are still in `new` status and older than 24 hours visually stand out in the admin Jobs list with red highlighting, matching the "Waiting" treatment shown in the prompt dialog.

## What changes

### 1. Admin job cards — red styling for stale jobs
In `src/pages/AdminJobs.tsx`, extend the card rendering logic so that any job with `status === "new"` that is older than `NEW_BADGE_MS` (24 hours) gets:
- A red border/ring highlight (`border-red-500` or `ring-2 ring-red-500/60`).
- A red "Waiting" badge (replacing the current blue "NEW" badge for these stale jobs).
- The existing hover behavior remains, but the red state should be visually dominant.

The current code only highlights jobs created *within* 24 hours as "NEW" (primary blue). This change adds the opposite case: jobs that have sat in `new` for more than 24 hours.

### 2. Keep the stale prompt dialog
The existing alert dialog that appears when there are stale jobs will remain unchanged; it already uses the red "Waiting" badge style.

## Technical notes
- File: `src/pages/AdminJobs.tsx` (`renderJobCard` function, around line 395).
- `NEW_BADGE_MS` is already defined (24 hours).
- No database changes are needed.
- No new dependencies are needed.
