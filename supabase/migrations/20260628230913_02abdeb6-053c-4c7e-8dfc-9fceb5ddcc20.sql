
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS brokerage text,
  ADD COLUMN IF NOT EXISTS headline text,
  ADD COLUMN IF NOT EXISTS profile_slug text UNIQUE;

CREATE OR REPLACE FUNCTION public.update_my_realtor_profile(
  _full_name text DEFAULT NULL,
  _photo_url text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _brokerage text DEFAULT NULL,
  _headline text DEFAULT NULL,
  _profile_slug text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_slug text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _profile_slug IS NOT NULL THEN
    v_slug := lower(regexp_replace(trim(_profile_slug), '[^a-z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    IF length(v_slug) < 3 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Slug must be at least 3 characters');
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE profile_slug = v_slug AND id <> auth.uid()) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That URL is already taken');
    END IF;
  END IF;

  UPDATE public.profiles
  SET
    full_name = COALESCE(_full_name, full_name),
    photo_url = COALESCE(_photo_url, photo_url),
    phone = COALESCE(_phone, phone),
    brokerage = COALESCE(_brokerage, brokerage),
    headline = COALESCE(_headline, headline),
    profile_slug = COALESCE(v_slug, profile_slug),
    updated_at = now()
  WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'slug', COALESCE(v_slug, (SELECT profile_slug FROM public.profiles WHERE id = auth.uid())));
END $$;

CREATE OR REPLACE FUNCTION public.get_realtor_public_profile(_slug text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_profile jsonb;
  v_listings jsonb;
  v_uid uuid;
BEGIN
  SELECT id, jsonb_build_object(
    'id', id,
    'full_name', full_name,
    'email', email,
    'photo_url', photo_url,
    'phone', phone,
    'brokerage', brokerage,
    'headline', headline,
    'profile_slug', profile_slug
  ) INTO v_uid, v_profile
  FROM public.profiles
  WHERE profile_slug = lower(trim(_slug));

  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'realtor'::public.app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Realtor not found');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(l) ORDER BY l.updated_at DESC), '[]'::jsonb) INTO v_listings
  FROM (
    SELECT id, title, public_slug, thumbnail_url, address, price_cents,
           listing_status, beds, baths, sqft, updated_at
    FROM public.flyers
    WHERE owner_id = v_uid
      AND category = 'realtor'
      AND status = 'published'
      AND listing_status IN ('active', 'pending')
  ) l;

  RETURN jsonb_build_object('ok', true, 'profile', v_profile, 'listings', v_listings);
END $$;

GRANT EXECUTE ON FUNCTION public.update_my_realtor_profile(text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_realtor_public_profile(text) TO anon, authenticated;
