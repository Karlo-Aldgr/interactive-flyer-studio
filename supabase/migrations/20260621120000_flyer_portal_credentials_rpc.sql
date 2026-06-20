-- Portal credentials: owners could INSERT via RLS, but admins/editors could not.
-- Use SECURITY DEFINER RPCs so staff managing a flyer can ensure/regenerate portal links.

CREATE OR REPLACE FUNCTION public.user_can_manage_flyer_portal(_flyer_id uuid)
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

REVOKE ALL ON FUNCTION public.user_can_manage_flyer_portal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_manage_flyer_portal(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_flyer_portal_credentials(_flyer_id uuid)
RETURNS TABLE(portal_token uuid, portal_access_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_can_manage_flyer_portal(_flyer_id) THEN
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

REVOKE ALL ON FUNCTION public.ensure_flyer_portal_credentials(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_flyer_portal_credentials(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.regenerate_flyer_portal_credentials(
  _flyer_id uuid,
  _reset_token boolean DEFAULT false,
  _reset_code boolean DEFAULT false
)
RETURNS TABLE(portal_token uuid, portal_access_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_can_manage_flyer_portal(_flyer_id) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  INSERT INTO public.flyer_portal_credentials (flyer_id)
  VALUES (_flyer_id)
  ON CONFLICT (flyer_id) DO NOTHING;

  UPDATE public.flyer_portal_credentials c
  SET
    portal_token = CASE WHEN _reset_token THEN gen_random_uuid() ELSE c.portal_token END,
    portal_access_code = CASE
      WHEN _reset_code THEN upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
      ELSE c.portal_access_code
    END,
    updated_at = now()
  WHERE c.flyer_id = _flyer_id;

  RETURN QUERY
  SELECT c.portal_token, c.portal_access_code
  FROM public.flyer_portal_credentials c
  WHERE c.flyer_id = _flyer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.regenerate_flyer_portal_credentials(uuid, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_flyer_portal_credentials(uuid, boolean, boolean) TO authenticated;
