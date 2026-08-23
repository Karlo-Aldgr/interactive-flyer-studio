# My projects: show paid/completed projects and pick which go to Socials

## Goal
Every job that is paid or completed shows on the owner's "My projects" page, and each one has a check button so the customer picks exactly which flyers get posted with "Post to Socials".

## What changes

### 1. Make sure paid/completed projects actually appear
Today the page lists only rows where the job's `user_id` matches the signed-in account. Projects created for a customer by an admin or created straight from the editor can end up attached to a different owner, so the customer sees "You haven't submitted any projects yet."

The page will load projects owned by the signed-in user through either link:
- jobs where `user_id` is the user, or
- jobs whose flyer is owned by the user (flyer `owner_id`).

Duplicate job rows pointing at the same flyer are collapsed, keeping the most advanced one (paid/completed wins over a duplicate "new" row).

### 2. Group the list
Two sections:
- **Ready to share** — paid or completed/delivered projects, listed first.
- **In progress** — everything else (new, in review, awaiting payment).

Each card keeps its existing badges, price, Preview, and Manage controls.

### 3. Selection for Post to Socials
- Only "Ready to share" projects get a check button; in-progress cards show a short "Available after payment" note instead of a checkbox.
- The checkbox becomes a clearly visible check button on the card (checkbox plus label), and a selected card gets a highlighted border so it is obvious what will be posted.
- "Select all" selects only the ready-to-share projects, and the counter reflects that.
- "Post to Socials" stays disabled until at least one is checked, and the dialog receives only those projects.

## Technical notes
- File: `src/pages/MyJobs.tsx` — query change (two fetches merged client-side: jobs by `user_id`, plus jobs joined to flyers with `owner_id` = user), dedupe by `flyer_id`, derive `isReady = share_unlocked || status in ('paid','completed','delivered')`, split into two groups, gate selection on `isReady`.
- No database or RLS change is required for the flyer-owner path as long as the customer can read their own flyers; if the read is blocked, an RLS policy allowing users to see jobs for flyers they own will be added in the same pass.
- `PostToSocialsDialog` is unchanged.
