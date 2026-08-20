CREATE OR REPLACE FUNCTION public.grant_admin_by_email(_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No user with that email');
  END IF;
  INSERT INTO public.user_roles(user_id, role)
  VALUES (_uid, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'user_id', _uid);
END $$;

CREATE OR REPLACE FUNCTION public.revoke_admin_by_email(_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid; _count int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No user with that email');
  END IF;
  IF _uid = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot remove your own admin access');
  END IF;
  SELECT count(*) INTO _count FROM public.user_roles WHERE role = 'admin'::public.app_role;
  IF _count <= 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'At least one admin must remain');
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _uid AND role = 'admin'::public.app_role;
  RETURN jsonb_build_object('ok', true, 'user_id', _uid);
END $$;

REVOKE ALL ON FUNCTION public.grant_admin_by_email(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.revoke_admin_by_email(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.grant_admin_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_admin_by_email(text) TO authenticated;