ALTER TABLE public.onboarding_submissions DROP CONSTRAINT IF EXISTS onboarding_submissions_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_submissions_flyer_job_id_key
  ON public.onboarding_submissions (flyer_job_id)
  WHERE flyer_job_id IS NOT NULL;