-- Allow flyer owners, admins, and staff editors to create/read marketing drafts.
-- Fixes: insert failed when admin publishes a client's flyer (owner_id != auth.uid()).

DROP POLICY IF EXISTS "Owners can insert own marketing drafts" ON public.marketing_drafts;
DROP POLICY IF EXISTS "Owners can read own marketing drafts" ON public.marketing_drafts;

CREATE POLICY "Flyer editors can insert marketing drafts"
  ON public.marketing_drafts FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = (SELECT f.owner_id FROM public.flyers f WHERE f.id = flyer_id)
    AND (
      owner_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.current_user_can_edit()
    )
  );

CREATE POLICY "Flyer editors can read marketing drafts"
  ON public.marketing_drafts FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.current_user_can_edit()
  );
