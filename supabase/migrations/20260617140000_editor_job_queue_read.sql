-- Phase 1: Editors can read customer job requests (shared queue; RLS still applies).
CREATE POLICY "editors read jobs"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'editor'::public.app_role));

-- Editors can open customer uploads via signed URLs.
CREATE POLICY "editors read job-uploads"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'job-uploads'
    AND public.has_role(auth.uid(), 'editor'::public.app_role)
  );
