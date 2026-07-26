
## Goal

New client onboarding portal at `/onboarding` that collects business intake info + a flyer upload, auto-creates a job from the flyer, pre-runs smart-detect for hotspot suggestions, and is visible to admins/editors on that job.

## Flow

1. New user signs up → `handle_new_user` sets `profiles.onboarding_completed_at = null` (default).
2. `Dashboard` / customer view checks: if `onboarding_completed_at IS NULL` and user is not admin/editor/realtor → redirect to `/onboarding`.
3. User completes form → row inserted into `onboarding_submissions`, flyer file uploaded to `job-uploads`, job created, smart-detect runs async, `onboarding_completed_at` stamped, redirect to Customer Dashboard.
4. Sidebar link "Onboarding info" always available afterward (read-only view + "Edit & resubmit").
5. Admin/editor sees the submission attached to the job in `JobDetailView`.

## Form fields

Grouped into 4 steps (single page, sectioned):

**About you**
- Full name (required)
- Phone number (required)
- Email (prefilled from auth, editable)

**Your business**
- Business name (required)
- Business address
- Business slogan / tagline
- Business description (long text — powers flyer chatbot later)

**Web & social presence**
- Website URL — if blank, radio: "Would you like us to build one?" → Yes / More info / Not now
- Facebook URL
- Instagram URL
- TikTok URL
- Other social (free text)
- If any key social missing, checkbox: "Help me set these up"

**Assets**
- Logo upload — if skipped, radio: "Would you like us to design one?" → Yes / More info / Not now
- Flyer upload (image or PDF, single file) — on submit, uploaded to `job-uploads`, job auto-created, `smart-detect` edge function invoked to generate hotspot suggestions saved on the submission row (JSON) and mirrored to the job for editors to accept in the editor.

Submit is enabled only when required fields are filled. Uses `zod` validation.

## Data model (migration)

New table `public.onboarding_submissions`:
- `id uuid pk default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade` (unique)
- `full_name`, `phone`, `email` text
- `business_name`, `business_address`, `business_slogan`, `business_description` text
- `website_url text`, `website_help text check in ('yes','more_info','no',null)`
- `facebook_url`, `instagram_url`, `tiktok_url`, `other_social_url` text
- `social_help boolean default false`
- `logo_url text`, `logo_help text check in ('yes','more_info','no',null)`
- `flyer_upload_url text`, `flyer_job_id uuid references public.jobs(id)`
- `hotspot_suggestions jsonb` (from smart-detect)
- `created_at`, `updated_at timestamptz`

Add `profiles.onboarding_completed_at timestamptz` (nullable).

GRANTs: `SELECT, INSERT, UPDATE` to `authenticated`; `ALL` to `service_role`. RLS:
- User: SELECT/INSERT/UPDATE own row (`user_id = auth.uid()`)
- Admin/editor: SELECT all (`has_role(auth.uid(),'admin') OR has_role(auth.uid(),'editor')`)

`update_updated_at` trigger.

Storage: reuse `flyer-assets` (public) for logo; `job-uploads` (private) for flyer.

## Files

New:
- `src/pages/Onboarding.tsx` — the form (sectioned, zod validated, upload progress)
- `src/lib/onboarding.ts` — `getMyOnboarding`, `submitOnboarding` (creates job, invokes smart-detect, upserts row, stamps `profiles.onboarding_completed_at`)
- `src/components/dashboard/OnboardingSubmissionCard.tsx` — read-only view rendered inside `JobDetailView` when the job has a linked submission (admin/editor + owner)
- `supabase/migrations/<ts>_onboarding_submissions.sql`

Edited:
- `src/App.tsx` — add `/onboarding` route (protected, no shell)
- `src/pages/Dashboard.tsx` — redirect to `/onboarding` when `onboarding_completed_at IS NULL` for non-editor/admin/realtor users
- `src/components/portal-customer/CustomerPortalSidebar.tsx` — add "Onboarding info" link
- `src/components/dashboard/JobDetailView.tsx` — show `OnboardingSubmissionCard` when present

No changes to existing job creation, smart-detect, or editor hotspot flow — we only invoke them.

## Notes

- Welcome copy is rendered at the top of `/onboarding`.
- "Assist me" answers are stored as-is; no auto-emails (per your choice).
- Smart-detect runs in the background; if it fails, submission still succeeds and hotspot_suggestions stays null (editor uses normal in-editor smart-detect).
