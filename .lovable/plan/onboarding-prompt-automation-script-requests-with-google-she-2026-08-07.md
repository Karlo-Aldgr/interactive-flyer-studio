# Onboarding Prompt + Automation Script Requests with Google Sheets Export

Three connected pieces: nudge every customer to finish onboarding when a new flyer appears, let each flyer carry an automation script request (AI-drafted, editable, plus a custom request form), and push every request to one master Google Sheet automatically.

## 1. Complete-onboarding prompt on new flyers

- When a customer's flyer is created (dashboard "New flyer", editor first save, and job/onboarding-created flyers), check whether their profile has finished onboarding.
- If not finished:
  - Show a one-time dialog: "Finish your onboarding so we can personalize this flyer" with **Complete onboarding** and **Later**.
  - Keep a persistent banner at the top of the dashboard and the customer portal until onboarding is completed. The banner never blocks work.
- Dialog is shown once per flyer creation (tracked locally); the banner is driven by the profile's onboarding-completed timestamp, so it disappears the moment onboarding is submitted.

## 2. Automation script request per flyer

A new "Automation scripts" panel available on each flyer (customer portal + editor, and visible to admin/editor staff in the job view).

Each request record holds:
- Flyer, owner, created date, status (`requested` → `drafting` → `ready` → `fulfilled`)
- Channel scripts: Facebook, Instagram, TikTok, Email (subject + body), SMS — each editable text
- A **custom automation request** free-text field where the customer describes what they want automated, plus optional target date and priority
- Staff notes and a fulfilled-by/at stamp

Flow:
1. Customer opens the panel, optionally writes a custom automation request, and clicks **Generate scripts**.
2. AI drafts all channel scripts from the flyer's title, category, business details from onboarding, and the flyer link. Drafting runs server-side.
3. Customer can edit any script inline and save; each save keeps the row current.
4. Admin/editor sees all requests in the admin jobs area with a filter for pending ones, can edit scripts and mark them fulfilled.

The existing marketing drafts feature stays as-is; this new panel is the request/fulfilment record that also feeds the sheet.

## 3. Automatic export to one master Google Sheet

- Connect a Google Sheets account once (workspace-level connection) and store the target spreadsheet ID in app settings, editable by an admin.
- Every time a script request is created, its scripts are generated, or staff mark it fulfilled, a row is appended/updated in the master sheet with:
  `Timestamp, Customer name, Email, Business, Flyer title, Flyer link, Status, Custom automation request, Facebook, Instagram, TikTok, Email subject, Email body, SMS, Staff notes`
- Appending happens server-side right after the record is saved, so the sheet stays current without any manual step.
- If the sheet append fails, the request is still saved and the failure is recorded so an admin can retry from a **Re-sync to Sheets** button.

## Technical notes

- New table `automation_script_requests` (flyer_id, owner_id, status, custom_request, priority, due_date, facebook/instagram/tiktok/email_subject/email_body/sms, staff_notes, sheet_row, sheet_synced_at, sheet_error, timestamps) with RLS: owner can read/write their own; admin and editor roles full access; explicit GRANTs.
- New edge function `automation-scripts` with actions `generate` (Lovable AI drafting), `save`, and `sync-sheet`; a shared helper appends/updates rows through the Google Sheets connector gateway.
- Master spreadsheet ID stored in `app_settings` under a `automation_scripts_sheet` key, set from an admin settings panel.
- Onboarding status read from `profiles.onboarding_completed_at`; banner component reused in `Dashboard` and the customer portal shell; dialog triggered from the flyer-creation paths in `Dashboard`, `useFlyerData`, and job-created flyers.
- Requires connecting Google Sheets during implementation; if the connection is skipped, everything else still works and rows queue for sync.
