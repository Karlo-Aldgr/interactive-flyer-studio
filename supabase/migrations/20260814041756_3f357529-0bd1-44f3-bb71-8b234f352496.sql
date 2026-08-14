-- ============ settings ============
INSERT INTO public.app_settings (key, value)
VALUES ('affiliate_program', '{"default_rate":20,"min_payout_cents":5000,"cookie_days":14}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============ clicks ============
CREATE TABLE public.affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  code text NOT NULL,
  channel text NOT NULL DEFAULT 'Link',
  referrer text,
  landing_path text,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_affiliate_clicks_affiliate ON public.affiliate_clicks(affiliate_id, created_at DESC);
GRANT SELECT ON public.affiliate_clicks TO authenticated;
GRANT ALL ON public.affiliate_clicks TO service_role;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliates read own clicks" ON public.affiliate_clicks FOR SELECT TO authenticated
USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));
CREATE POLICY "Admins read clicks" ON public.affiliate_clicks FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ============ payouts ============
CREATE TABLE public.affiliate_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'requested',
  method text NOT NULL DEFAULT 'paypal',
  payout_email text,
  admin_note text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.affiliate_payouts TO authenticated;
GRANT ALL ON public.affiliate_payouts TO service_role;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliates read own payouts" ON public.affiliate_payouts FOR SELECT TO authenticated
USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));
CREATE POLICY "Admins read payouts" ON public.affiliate_payouts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_affiliate_payouts_updated BEFORE UPDATE ON public.affiliate_payouts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ promo assets ============
CREATE TABLE public.affiliate_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  asset_type text NOT NULL DEFAULT 'banner',
  image_url text,
  link_url text,
  body_text text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.affiliate_assets TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.affiliate_assets TO authenticated;
GRANT ALL ON public.affiliate_assets TO service_role;
ALTER TABLE public.affiliate_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliates read active assets" ON public.affiliate_assets FOR SELECT TO authenticated
USING (active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert assets" ON public.affiliate_assets FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update assets" ON public.affiliate_assets FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete assets" ON public.affiliate_assets FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_affiliate_assets_updated BEFORE UPDATE ON public.affiliate_assets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ coupons ============
CREATE TABLE public.affiliate_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  description text,
  discount_percent numeric NOT NULL DEFAULT 10,
  active boolean NOT NULL DEFAULT true,
  redemption_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.affiliate_coupons TO authenticated;
GRANT ALL ON public.affiliate_coupons TO service_role;
ALTER TABLE public.affiliate_coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliates read own coupons" ON public.affiliate_coupons FOR SELECT TO authenticated
USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
       OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_affiliate_coupons_updated BEFORE UPDATE ON public.affiliate_coupons
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ notifications ============
CREATE TABLE public.affiliate_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.affiliate_notifications TO authenticated;
GRANT ALL ON public.affiliate_notifications TO service_role;
ALTER TABLE public.affiliate_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own affiliate notifications" ON public.affiliate_notifications FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users mark own notifications read" ON public.affiliate_notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ referral extensions ============
ALTER TABLE public.affiliate_referrals
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'Link',
  ADD COLUMN IF NOT EXISTS click_id uuid,
  ADD COLUMN IF NOT EXISTS fraud_flag text,
  ADD COLUMN IF NOT EXISTS commission_cents integer;

-- ============ tracking: click ============
CREATE OR REPLACE FUNCTION public.affiliate_track_click(
  _code text, _channel text DEFAULT 'Link', _referrer text DEFAULT NULL,
  _landing text DEFAULT NULL, _session text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aff public.affiliates%ROWTYPE; recent int;
BEGIN
  SELECT * INTO aff FROM public.affiliates WHERE lower(code) = lower(_code) AND status = 'active';
  IF aff.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_code'); END IF;
  SELECT count(*) INTO recent FROM public.affiliate_clicks
   WHERE affiliate_id = aff.id AND session_id IS NOT DISTINCT FROM _session
     AND created_at > now() - interval '30 minutes';
  IF recent = 0 THEN
    INSERT INTO public.affiliate_clicks (affiliate_id, code, channel, referrer, landing_path, session_id)
    VALUES (aff.id, aff.code, coalesce(nullif(_channel,''),'Link'), _referrer, _landing, _session);
  END IF;
  RETURN jsonb_build_object('ok', true, 'code', aff.code);
END; $$;
GRANT EXECUTE ON FUNCTION public.affiliate_track_click(text,text,text,text,text) TO anon, authenticated;

-- ============ tracking: signup attribution ============
CREATE OR REPLACE FUNCTION public.affiliate_attribute_signup(_code text, _channel text DEFAULT 'Link')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aff public.affiliates%ROWTYPE; uid uuid := auth.uid(); uemail text;
        existing uuid; flag text; fast int;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in'); END IF;
  SELECT * INTO aff FROM public.affiliates WHERE lower(code) = lower(_code) AND status = 'active';
  IF aff.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_code'); END IF;
  SELECT email INTO uemail FROM auth.users WHERE id = uid;

  SELECT id INTO existing FROM public.affiliate_referrals WHERE referred_user_id = uid LIMIT 1;
  IF existing IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'reason', 'already_attributed'); END IF;

  IF aff.user_id = uid OR lower(coalesce(aff.email,'')) = lower(coalesce(uemail,'')) THEN
    flag := 'self_referral';
  END IF;
  SELECT count(*) INTO fast FROM public.affiliate_referrals
   WHERE affiliate_id = aff.id AND created_at > now() - interval '5 minutes';
  IF flag IS NULL AND fast >= 3 THEN flag := 'rapid_repeat'; END IF;

  INSERT INTO public.affiliate_referrals (affiliate_id, referred_user_id, referred_email, source, channel, status, fraud_flag)
  VALUES (aff.id, uid, uemail, 'referral_link', coalesce(nullif(_channel,''),'Link'),
          CASE WHEN flag IS NULL THEN 'signed_up' ELSE 'flagged' END, flag);
  RETURN jsonb_build_object('ok', true, 'flag', flag);
END; $$;
GRANT EXECUTE ON FUNCTION public.affiliate_attribute_signup(text,text) TO authenticated;

-- ============ affiliate balance ============
CREATE OR REPLACE FUNCTION public.affiliate_balance(_affiliate_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'approved_cents', coalesce((SELECT sum(amount_cents) FROM public.affiliate_commissions
        WHERE affiliate_id = _affiliate_id AND status IN ('approved','paid')), 0),
    'pending_cents', coalesce((SELECT sum(amount_cents) FROM public.affiliate_commissions
        WHERE affiliate_id = _affiliate_id AND status = 'pending'), 0),
    'paid_out_cents', coalesce((SELECT sum(amount_cents) FROM public.affiliate_payouts
        WHERE affiliate_id = _affiliate_id AND status = 'paid'), 0),
    'requested_cents', coalesce((SELECT sum(amount_cents) FROM public.affiliate_payouts
        WHERE affiliate_id = _affiliate_id AND status IN ('requested','approved')), 0)
  );
$$;
GRANT EXECUTE ON FUNCTION public.affiliate_balance(uuid) TO authenticated;

-- ============ payout request ============
CREATE OR REPLACE FUNCTION public.affiliate_request_payout(_amount_cents integer, _payout_email text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aff public.affiliates%ROWTYPE; bal jsonb; available int; minimum int;
BEGIN
  SELECT * INTO aff FROM public.affiliates WHERE user_id = auth.uid();
  IF aff.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'message', 'Not an affiliate'); END IF;
  IF aff.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'message', 'Affiliate account is not active'); END IF;
  SELECT public.affiliate_balance(aff.id) INTO bal;
  available := (bal->>'approved_cents')::int - (bal->>'paid_out_cents')::int - (bal->>'requested_cents')::int;
  SELECT coalesce((value->>'min_payout_cents')::int, 5000) INTO minimum FROM public.app_settings WHERE key = 'affiliate_program';
  minimum := coalesce(minimum, 5000);
  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN _amount_cents := available; END IF;
  IF _amount_cents > available THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Requested amount exceeds available balance');
  END IF;
  IF _amount_cents < minimum THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Minimum payout is ' || to_char(minimum/100.0, 'FM999,999.00'));
  END IF;
  IF _payout_email IS NOT NULL AND length(trim(_payout_email)) > 0 THEN
    UPDATE public.affiliates SET payout_email = trim(_payout_email) WHERE id = aff.id;
    aff.payout_email := trim(_payout_email);
  END IF;
  INSERT INTO public.affiliate_payouts (affiliate_id, amount_cents, payout_email, status)
  VALUES (aff.id, _amount_cents, aff.payout_email, 'requested');
  INSERT INTO public.affiliate_notifications (user_id, affiliate_id, type, title, body)
  VALUES (aff.user_id, aff.id, 'payout_requested', 'Payout requested',
          'We received your payout request for ' || to_char(_amount_cents/100.0, 'FM999,999.00') || ' USD.');
  RETURN jsonb_build_object('ok', true, 'message', 'Payout requested');
END; $$;
GRANT EXECUTE ON FUNCTION public.affiliate_request_payout(integer,text) TO authenticated;

-- ============ admin: payouts ============
CREATE OR REPLACE FUNCTION public.admin_list_payouts()
RETURNS TABLE(id uuid, affiliate_id uuid, affiliate_name text, code text, amount_cents integer,
              status text, method text, payout_email text, admin_note text,
              requested_at timestamptz, paid_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.affiliate_id, coalesce(a.full_name, a.email, 'Affiliate'), a.code, p.amount_cents,
         p.status, p.method, p.payout_email, p.admin_note, p.requested_at, p.paid_at
  FROM public.affiliate_payouts p
  JOIN public.affiliates a ON a.id = p.affiliate_id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY p.requested_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_payouts() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_payout(_payout_id uuid, _status text, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.affiliate_payouts%ROWTYPE; aff public.affiliates%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN jsonb_build_object('ok', false, 'message', 'Admins only'); END IF;
  IF _status NOT IN ('requested','approved','paid','rejected') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Invalid status'); END IF;
  UPDATE public.affiliate_payouts
     SET status = _status,
         admin_note = coalesce(_note, admin_note),
         paid_at = CASE WHEN _status = 'paid' THEN now() ELSE NULL END
   WHERE id = _payout_id RETURNING * INTO p;
  IF p.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'message', 'Payout not found'); END IF;
  IF _status = 'paid' THEN
    UPDATE public.affiliate_commissions SET status = 'paid', paid_at = now()
     WHERE affiliate_id = p.affiliate_id AND status = 'approved';
  END IF;
  SELECT * INTO aff FROM public.affiliates WHERE id = p.affiliate_id;
  INSERT INTO public.affiliate_notifications (user_id, affiliate_id, type, title, body)
  VALUES (aff.user_id, aff.id, 'payout_' || _status, 'Payout ' || _status,
          'Your payout of ' || to_char(p.amount_cents/100.0, 'FM999,999.00') || ' USD is now ' || _status || '.');
  RETURN jsonb_build_object('ok', true, 'message', 'Payout ' || _status);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_payout(uuid,text,text) TO authenticated;

-- ============ admin: rates, commissions, coupons, referrals ============
CREATE OR REPLACE FUNCTION public.admin_set_affiliate_rate(_affiliate_id uuid, _rate numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN jsonb_build_object('ok', false, 'message', 'Admins only'); END IF;
  IF _rate < 0 OR _rate > 100 THEN RETURN jsonb_build_object('ok', false, 'message', 'Rate must be 0-100'); END IF;
  UPDATE public.affiliates SET commission_rate = _rate WHERE id = _affiliate_id;
  RETURN jsonb_build_object('ok', true, 'message', 'Commission rate updated');
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_set_affiliate_rate(uuid,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_record_conversion(
  _referral_id uuid, _sale_cents integer, _description text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.affiliate_referrals%ROWTYPE; aff public.affiliates%ROWTYPE; commission int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN jsonb_build_object('ok', false, 'message', 'Admins only'); END IF;
  SELECT * INTO r FROM public.affiliate_referrals WHERE id = _referral_id;
  IF r.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'message', 'Referral not found'); END IF;
  SELECT * INTO aff FROM public.affiliates WHERE id = r.affiliate_id;
  commission := round(_sale_cents * coalesce(aff.commission_rate, 20) / 100.0);
  UPDATE public.affiliate_referrals
     SET status = 'converted', converted_at = now(), commission_cents = commission
   WHERE id = _referral_id;
  INSERT INTO public.affiliate_commissions (affiliate_id, referral_id, amount_cents, status, description)
  VALUES (aff.id, r.id, commission, 'approved',
          coalesce(_description, 'Conversion commission (' || coalesce(aff.commission_rate,20) || '%)'));
  INSERT INTO public.affiliate_notifications (user_id, affiliate_id, type, title, body)
  VALUES (aff.user_id, aff.id, 'commission', 'New commission earned',
          'You earned ' || to_char(commission/100.0, 'FM999,999.00') || ' USD from a referral conversion.');
  RETURN jsonb_build_object('ok', true, 'commission_cents', commission);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_record_conversion(uuid,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_coupon(
  _code text, _affiliate_id uuid DEFAULT NULL, _description text DEFAULT NULL,
  _discount numeric DEFAULT 10, _active boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN jsonb_build_object('ok', false, 'message', 'Admins only'); END IF;
  INSERT INTO public.affiliate_coupons (code, affiliate_id, description, discount_percent, active)
  VALUES (upper(trim(_code)), _affiliate_id, _description, _discount, _active)
  ON CONFLICT (code) DO UPDATE SET affiliate_id = EXCLUDED.affiliate_id, description = EXCLUDED.description,
    discount_percent = EXCLUDED.discount_percent, active = EXCLUDED.active;
  RETURN jsonb_build_object('ok', true, 'message', 'Coupon saved');
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_upsert_coupon(text,uuid,text,numeric,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_coupon(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN jsonb_build_object('ok', false, 'message', 'Admins only'); END IF;
  DELETE FROM public.affiliate_coupons WHERE id = _id;
  RETURN jsonb_build_object('ok', true, 'message', 'Coupon deleted');
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_delete_coupon(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_referrals()
RETURNS TABLE(id uuid, affiliate_id uuid, affiliate_name text, code text, referred_email text,
              referred_name text, channel text, status text, fraud_flag text,
              commission_cents integer, converted_at timestamptz, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.affiliate_id, coalesce(a.full_name, a.email, 'Affiliate'), a.code, r.referred_email,
         r.referred_name, r.channel, r.status, r.fraud_flag, r.commission_cents, r.converted_at, r.created_at
  FROM public.affiliate_referrals r
  JOIN public.affiliates a ON a.id = r.affiliate_id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY r.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_referrals() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_commissions()
RETURNS TABLE(id uuid, affiliate_id uuid, affiliate_name text, code text, amount_cents integer,
              status text, description text, created_at timestamptz, paid_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.affiliate_id, coalesce(a.full_name, a.email, 'Affiliate'), a.code, c.amount_cents,
         c.status, c.description, c.created_at, c.paid_at
  FROM public.affiliate_commissions c
  JOIN public.affiliates a ON a.id = c.affiliate_id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY c.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_commissions() TO authenticated;

-- ============ admin analytics ============
CREATE OR REPLACE FUNCTION public.admin_affiliate_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN jsonb_build_object('error', 'Admins only'); END IF;
  SELECT jsonb_build_object(
    'participants', (SELECT count(*) FROM public.affiliates WHERE status = 'active'),
    'invites', (SELECT count(*) FROM public.affiliate_applications),
    'clicks', (SELECT count(*) FROM public.affiliate_clicks),
    'signups', (SELECT count(*) FROM public.affiliate_referrals),
    'converts', (SELECT count(*) FROM public.affiliate_referrals WHERE status = 'converted'),
    'earned_cents', (SELECT coalesce(sum(amount_cents),0) FROM public.affiliate_commissions),
    'paid_cents', (SELECT coalesce(sum(amount_cents),0) FROM public.affiliate_payouts WHERE status = 'paid'),
    'pending_payout_cents', (SELECT coalesce(sum(amount_cents),0) FROM public.affiliate_payouts WHERE status IN ('requested','approved')),
    'flagged', (SELECT count(*) FROM public.affiliate_referrals WHERE fraud_flag IS NOT NULL),
    'channels', coalesce((SELECT jsonb_agg(x) FROM (
        SELECT channel AS name, count(*) AS clicks,
               (SELECT count(*) FROM public.affiliate_referrals r WHERE r.channel = c.channel) AS signups
        FROM public.affiliate_clicks c GROUP BY channel ORDER BY count(*) DESC) x), '[]'::jsonb),
    'rows', coalesce((SELECT jsonb_agg(y) FROM (
        SELECT a.id, a.code, coalesce(a.full_name, a.email, 'Affiliate') AS name, a.status, a.commission_rate,
               (SELECT count(*) FROM public.affiliate_clicks c WHERE c.affiliate_id = a.id) AS clicks,
               (SELECT count(*) FROM public.affiliate_referrals r WHERE r.affiliate_id = a.id) AS signups,
               (SELECT count(*) FROM public.affiliate_referrals r WHERE r.affiliate_id = a.id AND r.status = 'converted') AS converts,
               (SELECT coalesce(sum(amount_cents),0) FROM public.affiliate_commissions m WHERE m.affiliate_id = a.id) AS earned_cents
        FROM public.affiliates a ORDER BY a.created_at DESC) y), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_affiliate_overview() TO authenticated;

-- ============ approval/rejection notifications ============
CREATE OR REPLACE FUNCTION public.affiliate_application_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.applicant_user_id IS NOT NULL THEN
    INSERT INTO public.affiliate_notifications (user_id, type, title, body)
    VALUES (NEW.applicant_user_id, 'application_' || NEW.status,
            CASE WHEN NEW.status = 'approved' THEN 'Affiliate application approved'
                 ELSE 'Affiliate application update' END,
            coalesce(NEW.review_notes,
              CASE WHEN NEW.status = 'approved'
                   THEN 'Welcome aboard! Your affiliate dashboard is now unlocked.'
                   ELSE 'Your affiliate application status is now ' || NEW.status || '.' END));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_affiliate_application_notify AFTER UPDATE ON public.affiliate_applications
FOR EACH ROW EXECUTE FUNCTION public.affiliate_application_notify();