-- Allow owners, admins, and editors to save flyer content (pages, layers, actions).
-- Fixes: "new row violates row-level security policy for table actions" when staff edit flyers.

CREATE OR REPLACE FUNCTION public.user_can_manage_flyer(_flyer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.flyers f
    WHERE f.id = _flyer_id
      AND (
        f.owner_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.current_user_can_edit()
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_manage_flyer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_manage_flyer(uuid) TO authenticated;

-- Ensure novel action type exists (Novel / Story preset)
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'novel';

CREATE POLICY "staff manage pages"
  ON public.pages FOR ALL TO authenticated
  USING (public.user_can_manage_flyer(flyer_id))
  WITH CHECK (public.user_can_manage_flyer(flyer_id));

CREATE POLICY "staff manage layers"
  ON public.layers FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_id AND public.user_can_manage_flyer(p.flyer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_id AND public.user_can_manage_flyer(p.flyer_id)
    )
  );

CREATE POLICY "staff manage actions"
  ON public.actions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.layers l
      JOIN public.pages p ON p.id = l.page_id
      WHERE l.id = layer_id AND public.user_can_manage_flyer(p.flyer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.layers l
      JOIN public.pages p ON p.id = l.page_id
      WHERE l.id = layer_id AND public.user_can_manage_flyer(p.flyer_id)
    )
  );
