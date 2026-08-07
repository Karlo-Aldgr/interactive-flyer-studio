ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS automation_sheet_id text,
  ADD COLUMN IF NOT EXISTS automation_sheet_tab text;

ALTER TABLE public.onboarding_submissions
  ADD COLUMN IF NOT EXISTS google_sheet_url text,
  ADD COLUMN IF NOT EXISTS google_sheet_tab text;

ALTER TABLE public.automation_script_requests
  ADD COLUMN IF NOT EXISTS sheet_spreadsheet_id text;