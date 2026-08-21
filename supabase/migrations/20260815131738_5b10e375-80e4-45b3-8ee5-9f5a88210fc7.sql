-- 1) Dedupe existing referral rows
DELETE FROM public.affiliate_referrals r
USING public.affiliate_referrals keep
WHERE r.referred_user_id IS NOT NULL
  AND keep.referred_user_id = r.referred_user_id
  AND (keep.created_at < r.created_at OR (keep.created_at = r.created_at AND keep.id < r.id));

DELETE FROM public.affiliate_referrals r
USING public.affiliate_referrals keep
WHERE r.referred_email IS NOT NULL
  AND lower(keep.referred_email) = lower(r.referred_email)
  AND keep.affiliate_id = r.affiliate_id
  AND (keep.created_at < r.created_at OR (keep.created_at = r.created_at AND keep.id < r.id));

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_referrals_user_uniq
  ON public.affiliate_referrals (referred_user_id) WHERE referred_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_referrals_email_uniq
  ON public.affiliate_referrals (affiliate_id, lower(referred_email)) WHERE referred_email IS NOT NULL;

-- 2) Block duplicate pending applications per email
DELETE FROM public.affiliate_applications a
USING public.affiliate_applications keep
WHERE a.status = 'pending' AND keep.status = 'pending'
  AND lower(keep.email) = lower(a.email)
  AND (keep.created_at > a.created_at OR (keep.created_at = a.created_at AND keep.id < a.id));

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_applications_pending_email_uniq
  ON public.affiliate_applications (lower(email)) WHERE status = 'pending';

-- 3) Applicants can view applications submitted with their email
DROP POLICY IF EXISTS "Applicants can view their own application by email" ON public.affiliate_applications;
CREATE POLICY "Applicants can view their own application by email"
ON public.affiliate_applications FOR SELECT TO authenticated
USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- 4) Signed-in users can read the public affiliate program settings
DROP POLICY IF EXISTS "authenticated read affiliate program settings" ON public.app_settings;
CREATE POLICY "authenticated read affiliate program settings"
ON public.app_settings FOR SELECT TO authenticated
USING (key = 'affiliate_program');

-- 5) Idempotent attribution (dedupe by user and by email; tolerate races)
CREATE OR REPLACE FUNCTION public.affiliate_attribute_signup(_code text, _channel text DEFAULT 'Link'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE aff public.affiliates%ROWTYPE; uid uuid := auth.uid(); uemail text;
        existing uuid; flag text; fast int;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in'); END IF;
  SELECT * INTO aff FROM public.affiliates WHERE lower(code) = lower(_code) AND status = 'active';
  IF aff.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_code'); END IF;
  SELECT email INTO uemail FROM auth.users WHERE id = uid;

  SELECT id INTO existing FROM public.affiliate_referrals
   WHERE referred_user_id = uid
      OR (uemail IS NOT NULL AND lower(coalesce(referred_email,'')) = lower(uemail))
   LIMIT 1;
  IF existing IS NOT NULL THEN
    UPDATE public.affiliate_referrals
       SET referred_user_id = COALESCE(referred_user_id, uid)
     WHERE id = existing;
    RETURN jsonb_build_object('ok', true, 'reason', 'already_attributed');
  END IF;

  IF aff.user_id = uid OR lower(coalesce(aff.email,'')) = lower(coalesce(uemail,'')) THEN
    flag := 'self_referral';
  END IF;
  SELECT count(*) INTO fast FROM public.affiliate_referrals
   WHERE affiliate_id = aff.id AND created_at > now() - interval '5 minutes';
  IF flag IS NULL AND fast >= 3 THEN flag := 'rapid_repeat'; END IF;

  BEGIN
    INSERT INTO public.affiliate_referrals (affiliate_id, referred_user_id, referred_email, source, channel, status, fraud_flag)
    VALUES (aff.id, uid, uemail, 'referral_link', coalesce(nullif(_channel,''),'Link'),
            CASE WHEN flag IS NULL THEN 'signed_up' ELSE 'flagged' END, flag);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_attributed');
  END;
  RETURN jsonb_build_object('ok', true, 'flag', flag);
END; $function$;