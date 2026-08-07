ALTER TABLE public.onboarding_submissions
  ADD COLUMN IF NOT EXISTS posting_permission boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS posting_permission_name text,
  ADD COLUMN IF NOT EXISTS posting_permission_at timestamptz,
  ADD COLUMN IF NOT EXISTS facebook_page_name text,
  ADD COLUMN IF NOT EXISTS instagram_handle text;