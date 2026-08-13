-- Affiliate portal foundation (20260813140000_affiliate_portal_foundation.sql)

CREATE TABLE public.affiliate_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  website text,
  audience text,
  message text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.affiliate_applications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_applications TO authenticated;
GRANT ALL ON public.affiliate_applications TO service_role;
ALTER TABLE public.affiliate_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an affiliate application"
  ON public.affiliate_applications FOR INSERT TO anon, authenticated
  WITH CHECK (applicant_user_id IS NULL OR applicant_user_id = auth.uid());
CREATE POLICY "Applicants can view their own application"
  ON public.affiliate_applications FOR SELECT TO authenticated
  USING (applicant_user_id = auth.uid());
CREATE POLICY "Admins can view all affiliate applications"
  ON public.affiliate_applications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update affiliate applications"
  ON public.affiliate_applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete affiliate applications"
  ON public.affiliate_applications FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  full_name text,
  email text,
  payout_email text,
  commission_rate numeric NOT NULL DEFAULT 20,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.affiliates TO authenticated;
GRANT ALL ON public.affiliates TO service_role;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can view their own record"
  ON public.affiliates FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Affiliates can update their own payout info"
  ON public.affiliates FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can manage affiliates"
  ON public.affiliates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_affiliate(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.affiliates
    WHERE user_id = _user_id AND status = 'active'
  )
$$;

CREATE TABLE public.affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referred_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_email text,
  referred_name text,
  source text,
  status text NOT NULL DEFAULT 'pending',
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX affiliate_referrals_affiliate_idx ON public.affiliate_referrals(affiliate_id);
GRANT SELECT ON public.affiliate_referrals TO authenticated;
GRANT ALL ON public.affiliate_referrals TO service_role;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can view their own referrals"
  ON public.affiliate_referrals FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins can manage referrals"
  ON public.affiliate_referrals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referral_id uuid REFERENCES public.affiliate_referrals(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending',
  description text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX affiliate_commissions_affiliate_idx ON public.affiliate_commissions(affiliate_id);
GRANT SELECT ON public.affiliate_commissions TO authenticated;
GRANT ALL ON public.affiliate_commissions TO service_role;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can view their own commissions"
  ON public.affiliate_commissions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins can manage commissions"
  ON public.affiliate_commissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER affiliate_applications_set_updated_at BEFORE UPDATE ON public.affiliate_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER affiliates_set_updated_at BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER affiliate_referrals_set_updated_at BEFORE UPDATE ON public.affiliate_referrals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER affiliate_commissions_set_updated_at BEFORE UPDATE ON public.affiliate_commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Admin helpers
CREATE OR REPLACE FUNCTION public.admin_list_affiliate_applications()
RETURNS SETOF public.affiliate_applications
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.affiliate_applications
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.admin_review_affiliate_application(
  _application_id uuid,
  _decision text,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app public.affiliate_applications%ROWTYPE;
  target_user uuid;
  new_code text;
  aff_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  UPDATE public.affiliate_applications
  SET status = _decision,
      review_notes = _notes,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = _application_id
  RETURNING * INTO app;

  IF app.id IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF _decision <> 'approved' THEN
    RETURN jsonb_build_object('status', 'rejected');
  END IF;

  target_user := COALESCE(
    app.applicant_user_id,
    (SELECT id FROM auth.users WHERE lower(email) = lower(app.email) LIMIT 1)
  );

  IF target_user IS NULL THEN
    RETURN jsonb_build_object('status', 'approved', 'affiliate_created', false,
      'message', 'Approved. Affiliate account will be created once the person signs up with this email.');
  END IF;

  SELECT id INTO aff_id FROM public.affiliates WHERE user_id = target_user;
  IF aff_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'approved', 'affiliate_created', false, 'affiliate_id', aff_id);
  END IF;

  LOOP
    new_code := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.affiliates WHERE code = new_code);
  END LOOP;

  INSERT INTO public.affiliates (user_id, code, full_name, email, payout_email)
  VALUES (target_user, new_code, app.full_name, app.email, app.email)
  RETURNING id INTO aff_id;

  RETURN jsonb_build_object('status', 'approved', 'affiliate_created', true,
    'affiliate_id', aff_id, 'code', new_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_affiliates()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  code text,
  full_name text,
  email text,
  payout_email text,
  commission_rate numeric,
  status text,
  created_at timestamptz,
  referral_count bigint,
  pending_cents bigint,
  paid_cents bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.user_id, a.code, a.full_name, a.email, a.payout_email,
         a.commission_rate, a.status, a.created_at,
         (SELECT count(*) FROM public.affiliate_referrals r WHERE r.affiliate_id = a.id),
         COALESCE((SELECT sum(c.amount_cents) FROM public.affiliate_commissions c WHERE c.affiliate_id = a.id AND c.status <> 'paid'), 0),
         COALESCE((SELECT sum(c.amount_cents) FROM public.affiliate_commissions c WHERE c.affiliate_id = a.id AND c.status = 'paid'), 0)
  FROM public.affiliates a
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY a.created_at DESC
$$;