CREATE OR REPLACE FUNCTION public.user_owns_flyer(_flyer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.flyers f
    WHERE f.id = _flyer_id AND f.owner_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "users see jobs for flyers they own" ON public.jobs;
CREATE POLICY "users see jobs for flyers they own"
ON public.jobs FOR SELECT TO authenticated
USING (deleted_at IS NULL AND flyer_id IS NOT NULL AND public.user_owns_flyer(flyer_id));