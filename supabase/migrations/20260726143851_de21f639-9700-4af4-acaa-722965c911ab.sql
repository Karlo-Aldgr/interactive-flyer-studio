
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.onboarding_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  email text,
  business_name text,
  business_address text,
  business_slogan text,
  business_description text,
  website_url text,
  website_help text CHECK (website_help IS NULL OR website_help IN ('yes','more_info','no')),
  facebook_url text,
  instagram_url text,
  tiktok_url text,
  other_social_url text,
  social_help boolean NOT NULL DEFAULT false,
  logo_url text,
  logo_help text CHECK (logo_help IS NULL OR logo_help IN ('yes','more_info','no')),
  flyer_upload_url text,
  flyer_job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  hotspot_suggestions jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.onboarding_submissions TO authenticated;
GRANT ALL ON public.onboarding_submissions TO service_role;

ALTER TABLE public.onboarding_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own onboarding"
  ON public.onboarding_submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'editor'::public.app_role));

CREATE POLICY "users insert own onboarding"
  ON public.onboarding_submissions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users update own onboarding"
  ON public.onboarding_submissions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS onboarding_submissions_flyer_job_id_idx
  ON public.onboarding_submissions(flyer_job_id);

CREATE TRIGGER trg_onboarding_submissions_updated_at
  BEFORE UPDATE ON public.onboarding_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
