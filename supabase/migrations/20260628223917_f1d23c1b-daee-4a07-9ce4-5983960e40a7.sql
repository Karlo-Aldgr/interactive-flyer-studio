
-- 1. Extend enums
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'realtor';
ALTER TYPE public.flyer_category ADD VALUE IF NOT EXISTS 'realtor';

-- 2. Add listing fields to flyers
ALTER TABLE public.flyers
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS price_cents bigint,
  ADD COLUMN IF NOT EXISTS listing_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS beds integer,
  ADD COLUMN IF NOT EXISTS baths numeric(3,1),
  ADD COLUMN IF NOT EXISTS sqft integer;

ALTER TABLE public.flyers
  DROP CONSTRAINT IF EXISTS flyers_listing_status_check;
ALTER TABLE public.flyers
  ADD CONSTRAINT flyers_listing_status_check
  CHECK (listing_status IN ('active','sold','draft','pending'));

-- 3. listing_photos table
CREATE TABLE IF NOT EXISTS public.listing_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_id uuid NOT NULL REFERENCES public.flyers(id) ON DELETE CASCADE,
  url text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  position integer NOT NULL DEFAULT 0,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_photos_category_check
    CHECK (category IN ('exterior','interior','kitchen','bathroom','amenities','other'))
);

CREATE INDEX IF NOT EXISTS listing_photos_flyer_pos_idx
  ON public.listing_photos (flyer_id, position);

GRANT SELECT ON public.listing_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_photos TO authenticated;
GRANT ALL ON public.listing_photos TO service_role;

ALTER TABLE public.listing_photos ENABLE ROW LEVEL SECURITY;

-- Public can read photos of published flyers
DROP POLICY IF EXISTS "Public can view photos of published listings" ON public.listing_photos;
CREATE POLICY "Public can view photos of published listings"
  ON public.listing_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.flyers f
      WHERE f.id = listing_photos.flyer_id
        AND f.status = 'published'::public.flyer_status
    )
  );

-- Owners / admins / editors can read all their photos (incl. drafts)
DROP POLICY IF EXISTS "Owners can read listing photos" ON public.listing_photos;
CREATE POLICY "Owners can read listing photos"
  ON public.listing_photos FOR SELECT
  TO authenticated
  USING (public.user_can_manage_flyer(flyer_id));

DROP POLICY IF EXISTS "Owners can insert listing photos" ON public.listing_photos;
CREATE POLICY "Owners can insert listing photos"
  ON public.listing_photos FOR INSERT
  TO authenticated
  WITH CHECK (public.user_can_manage_flyer(flyer_id));

DROP POLICY IF EXISTS "Owners can update listing photos" ON public.listing_photos;
CREATE POLICY "Owners can update listing photos"
  ON public.listing_photos FOR UPDATE
  TO authenticated
  USING (public.user_can_manage_flyer(flyer_id))
  WITH CHECK (public.user_can_manage_flyer(flyer_id));

DROP POLICY IF EXISTS "Owners can delete listing photos" ON public.listing_photos;
CREATE POLICY "Owners can delete listing photos"
  ON public.listing_photos FOR DELETE
  TO authenticated
  USING (public.user_can_manage_flyer(flyer_id));

CREATE OR REPLACE TRIGGER trg_listing_photos_updated_at
  BEFORE UPDATE ON public.listing_photos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Analytics helpers (views + leads per flyer)
CREATE OR REPLACE FUNCTION public.flyer_view_count(_flyer_id uuid)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*)::bigint FROM public.analytics_events
  WHERE flyer_id = _flyer_id AND event_type::text = 'view'
$$;

CREATE OR REPLACE FUNCTION public.flyer_lead_count(_flyer_id uuid)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (
    (SELECT count(*) FROM public.form_submissions WHERE flyer_id = _flyer_id) +
    (SELECT count(*) FROM public.appointments WHERE flyer_id = _flyer_id) +
    (SELECT count(*) FROM public.subscribers WHERE flyer_id = _flyer_id)
  )::bigint
$$;

CREATE OR REPLACE FUNCTION public.realtor_listing_stats(_flyer_ids uuid[])
RETURNS TABLE (flyer_id uuid, views bigint, leads bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    f.id,
    public.flyer_view_count(f.id),
    public.flyer_lead_count(f.id)
  FROM public.flyers f
  WHERE f.id = ANY(_flyer_ids)
    AND public.user_can_manage_flyer(f.id)
$$;

-- 5. Admin grant/revoke realtor role
CREATE OR REPLACE FUNCTION public.grant_realtor_by_email(_email text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No user with that email');
  END IF;
  INSERT INTO public.user_roles(user_id, role)
  VALUES (_uid, 'realtor'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'user_id', _uid);
END $$;

CREATE OR REPLACE FUNCTION public.revoke_realtor_by_email(_email text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No user with that email');
  END IF;
  DELETE FROM public.user_roles
   WHERE user_id = _uid AND role::text = 'realtor';
  RETURN jsonb_build_object('ok', true);
END $$;

-- 6. Let realtors be treated as "can edit" for their own flyers via existing helpers.
-- user_can_manage_flyer already covers owner_id = auth.uid(), so realtors who own
-- the flyer pass automatically. No change needed there.
