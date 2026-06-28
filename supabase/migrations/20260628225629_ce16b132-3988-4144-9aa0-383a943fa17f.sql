
CREATE TABLE public.realtor_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  brokerage text,
  license_number text,
  phone text,
  website text,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.realtor_applications TO anon;
GRANT SELECT, INSERT, UPDATE ON public.realtor_applications TO authenticated;
GRANT ALL ON public.realtor_applications TO service_role;

ALTER TABLE public.realtor_applications ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an application
CREATE POLICY "Anyone can submit application"
  ON public.realtor_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Applicants can see their own (matched by user id or email)
CREATE POLICY "Applicant sees own"
  ON public.realtor_applications FOR SELECT
  TO authenticated
  USING (
    applicant_user_id = auth.uid()
    OR lower(email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))
  );

-- Admins can see and manage everything
CREATE POLICY "Admins manage all applications"
  ON public.realtor_applications FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER realtor_applications_updated_at
  BEFORE UPDATE ON public.realtor_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Admin RPC: approve an application (grants realtor role to matching user)
CREATE OR REPLACE FUNCTION public.admin_review_realtor_application(_application_id uuid, _decision text, _notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _app public.realtor_applications;
  _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _decision NOT IN ('approved','rejected') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid decision');
  END IF;

  SELECT * INTO _app FROM public.realtor_applications WHERE id = _application_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Application not found');
  END IF;

  UPDATE public.realtor_applications
  SET status = _decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = _notes
  WHERE id = _application_id;

  IF _decision = 'approved' THEN
    -- find user by stored id or email
    _uid := _app.applicant_user_id;
    IF _uid IS NULL THEN
      SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_app.email) LIMIT 1;
    END IF;
    IF _uid IS NOT NULL THEN
      INSERT INTO public.user_roles(user_id, role)
      VALUES (_uid, 'realtor'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
      RETURN jsonb_build_object('ok', true, 'granted', true, 'user_id', _uid);
    END IF;
    RETURN jsonb_build_object('ok', true, 'granted', false, 'note', 'No matching user account yet; role will be granted when they sign up with this email.');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- When a new user signs up, auto-grant realtor role if they have an approved application matching their email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.profiles (id, email, created_at)
  VALUES (new.id, new.email, new.created_at)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;

  -- Auto-grant realtor if there's an approved application matching this email
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

  RETURN new;
END;
$$;

-- List applications for admin UI
CREATE OR REPLACE FUNCTION public.admin_list_realtor_applications()
RETURNS SETOF public.realtor_applications
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT * FROM public.realtor_applications ORDER BY created_at DESC;
END;
$$;
