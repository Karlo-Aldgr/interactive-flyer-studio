-- Allow job customers (and flyer owners) to fetch their flyer's one-click portal link
-- without exposing portal credentials via broad RLS.

CREATE OR REPLACE FUNCTION public.user_can_access_customer_flyer_portal(_flyer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.flyers f
    WHERE f.id = _flyer_id
      AND f.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.flyer_id = _flyer_id
      AND j.user_id = auth.uid()
      AND j.deleted_at IS NULL
      AND (
        j.share_unlocked = true
        OR j.status IN ('paid', 'completed', 'delivered')
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_access_customer_flyer_portal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_customer_flyer_portal(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_customer_flyer_portal_link(_flyer_id uuid)
RETURNS TABLE(portal_token uuid, portal_access_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_can_access_customer_flyer_portal(_flyer_id) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  INSERT INTO public.flyer_portal_credentials (flyer_id)
  VALUES (_flyer_id)
  ON CONFLICT (flyer_id) DO NOTHING;

  RETURN QUERY
  SELECT c.portal_token, c.portal_access_code
  FROM public.flyer_portal_credentials c
  WHERE c.flyer_id = _flyer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_flyer_portal_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_flyer_portal_link(uuid) TO authenticated;
