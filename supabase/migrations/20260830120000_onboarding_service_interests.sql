-- Onboarding: explicit service-interest checkboxes (automation/marketing, bizad, website).
ALTER TABLE public.onboarding_submissions
  ADD COLUMN IF NOT EXISTS service_interests text[] NOT NULL DEFAULT '{}';
