-- Admin-only: grant editor role to user by email
CREATE OR REPLACE FUNCTION public.grant_editor_by_email(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No user with that email');
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (_uid, 'editor')
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'user_id', _uid);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_editor_by_email(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No user with that email');
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _uid AND role = 'editor';
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_editors()
RETURNS TABLE(user_id uuid, email text, granted_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT ur.user_id, u.email::text, u.created_at
    FROM public.user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    WHERE ur.role = 'editor'
    ORDER BY u.email;
END;
$$;

-- Function to let the current user check their own access tier
CREATE OR REPLACE FUNCTION public.current_user_can_edit()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin','editor')
  );
$$;

REVOKE ALL ON FUNCTION public.grant_editor_by_email(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_editor_by_email(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_editors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_editor_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_editor_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_editors() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_edit() TO authenticated;
