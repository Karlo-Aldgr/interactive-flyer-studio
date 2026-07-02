
-- 1. Table
CREATE TABLE public.realtor_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  email text,
  invited_name text,
  note text,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX realtor_invites_token_idx ON public.realtor_invites(token);
CREATE INDEX realtor_invites_email_idx ON public.realtor_invites(lower(email));

-- 2. Grants (no anon; access is via SECURITY DEFINER RPCs)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.realtor_invites TO authenticated;
GRANT ALL ON public.realtor_invites TO service_role;

-- 3. RLS
ALTER TABLE public.realtor_invites ENABLE ROW LEVEL SECURITY;

-- 4. Policies (admins only via direct table)
CREATE POLICY "Admins manage realtor invites"
  ON public.realtor_invites
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- updated_at trigger
CREATE TRIGGER realtor_invites_set_updated_at
  BEFORE UPDATE ON public.realtor_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. RPCs
CREATE OR REPLACE FUNCTION public.admin_create_realtor_invite(
  _email text DEFAULT NULL,
  _name text DEFAULT NULL,
  _note text DEFAULT NULL,
  _expires_days int DEFAULT 30
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_token uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.realtor_invites (email, invited_name, note, invited_by, expires_at)
  VALUES (
    NULLIF(lower(trim(_email)), ''),
    NULLIF(trim(_name), ''),
    NULLIF(trim(_note), ''),
    auth.uid(),
    now() + make_interval(days => GREATEST(COALESCE(_expires_days, 30), 1))
  )
  RETURNING id, token INTO v_id, v_token;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'token', v_token);
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_realtor_invites()
RETURNS SETOF public.realtor_invites
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT * FROM public.realtor_invites ORDER BY created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.admin_revoke_realtor_invite(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.realtor_invites
     SET status = 'revoked'
   WHERE id = _id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invite not found or already handled');
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.resolve_realtor_invite(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.realtor_invites;
BEGIN
  SELECT * INTO r FROM public.realtor_invites WHERE token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;
  IF r.status = 'pending' AND r.expires_at < now() THEN
    RETURN jsonb_build_object('ok', true, 'status', 'expired', 'email', r.email, 'invited_name', r.invited_name);
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'status', r.status,
    'email', r.email,
    'invited_name', r.invited_name,
    'note', r.note,
    'expires_at', r.expires_at
  );
END $$;

CREATE OR REPLACE FUNCTION public.accept_realtor_invite(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.realtor_invites;
  v_user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please sign in first');
  END IF;

  SELECT * INTO r FROM public.realtor_invites WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid invite');
  END IF;
  IF r.status = 'accepted' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This invite was already used');
  END IF;
  IF r.status = 'revoked' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This invite was revoked');
  END IF;
  IF r.expires_at < now() THEN
    UPDATE public.realtor_invites SET status = 'expired' WHERE id = r.id;
    RETURN jsonb_build_object('ok', false, 'error', 'This invite has expired');
  END IF;

  IF r.email IS NOT NULL THEN
    SELECT email::text INTO v_user_email FROM auth.users WHERE id = auth.uid();
    IF lower(v_user_email) <> lower(r.email) THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'This invite was sent to ' || r.email || '. Please sign in with that email.');
    END IF;
  END IF;

  INSERT INTO public.user_roles(user_id, role)
  VALUES (auth.uid(), 'realtor'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.realtor_invites
     SET status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
   WHERE id = r.id;

  RETURN jsonb_build_object('ok', true);
END $$;

-- 6. Extend handle_new_user() to auto-accept pending email-targeted invites
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.profiles (id, email, created_at)
  VALUES (new.id, new.email, new.created_at)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  -- Approved realtor application match
  IF EXISTS (
    SELECT 1 FROM public.realtor_applications
    WHERE lower(email) = lower(new.email) AND status = 'approved'
  ) THEN
    INSERT INTO public.user_roles(user_id, role)
    VALUES (new.id, 'realtor'::public.app_role)
    ON CONFLICT DO NOTHING;

    UPDATE public.realtor_applications
       SET applicant_user_id = new.id
     WHERE lower(email) = lower(new.email) AND applicant_user_id IS NULL;
  END IF;

  -- Pending realtor invite match by email
  IF EXISTS (
    SELECT 1 FROM public.realtor_invites
    WHERE lower(email) = lower(new.email)
      AND status = 'pending'
      AND expires_at > now()
  ) THEN
    INSERT INTO public.user_roles(user_id, role)
    VALUES (new.id, 'realtor'::public.app_role)
    ON CONFLICT DO NOTHING;

    UPDATE public.realtor_invites
       SET status = 'accepted', accepted_by = new.id, accepted_at = now()
     WHERE lower(email) = lower(new.email)
       AND status = 'pending'
       AND expires_at > now();
  END IF;

  RETURN new;
END $$;
