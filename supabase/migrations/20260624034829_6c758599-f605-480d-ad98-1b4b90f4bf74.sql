
-- 1. mini_ads table
CREATE TABLE public.mini_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  click_url text NOT NULL,
  alt_text text,
  active boolean NOT NULL DEFAULT true,
  weight integer NOT NULL DEFAULT 1,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mini_ads TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mini_ads TO authenticated;
GRANT ALL ON public.mini_ads TO service_role;

ALTER TABLE public.mini_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active mini ads"
  ON public.mini_ads FOR SELECT
  USING (
    active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );

CREATE POLICY "Admins read all mini ads"
  ON public.mini_ads FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage mini ads"
  ON public.mini_ads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER mini_ads_set_updated_at
  BEFORE UPDATE ON public.mini_ads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. mini_ad_events table
CREATE TABLE public.mini_ad_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mini_ad_id uuid NOT NULL REFERENCES public.mini_ads(id) ON DELETE CASCADE,
  flyer_id uuid REFERENCES public.flyers(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('impression', 'click')),
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mini_ad_events_ad_idx ON public.mini_ad_events(mini_ad_id, created_at DESC);
CREATE INDEX mini_ad_events_flyer_idx ON public.mini_ad_events(flyer_id, created_at DESC);

GRANT INSERT ON public.mini_ad_events TO anon, authenticated;
GRANT SELECT ON public.mini_ad_events TO authenticated;
GRANT ALL ON public.mini_ad_events TO service_role;

ALTER TABLE public.mini_ad_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert mini ad events"
  ON public.mini_ad_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins read all mini ad events"
  ON public.mini_ad_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Flyer owners read their mini ad events"
  ON public.mini_ad_events FOR SELECT TO authenticated
  USING (
    flyer_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid())
  );

-- 3. jobs columns
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS mini_ad_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mini_ad_paid boolean NOT NULL DEFAULT false;

-- 4. flyer_mini_ad_enabled helper (public-facing)
CREATE OR REPLACE FUNCTION public.flyer_mini_ad_enabled(_flyer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.flyer_id = _flyer_id
      AND j.mini_ad_enabled = true
      AND j.deleted_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.flyer_mini_ad_enabled(uuid) TO anon, authenticated;

-- 5. pick_mini_ad — weighted random active ad
CREATE OR REPLACE FUNCTION public.pick_mini_ad()
RETURNS TABLE(id uuid, image_url text, click_url text, alt_text text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.image_url, m.click_url, m.alt_text
  FROM public.mini_ads m
  WHERE m.active = true
    AND (m.starts_at IS NULL OR m.starts_at <= now())
    AND (m.ends_at IS NULL OR m.ends_at >= now())
  ORDER BY random() * (1.0 / GREATEST(m.weight, 1))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.pick_mini_ad() TO anon, authenticated;

-- 6. admin_set_job_mini_ad
CREATE OR REPLACE FUNCTION public.admin_set_job_mini_ad(_job_id uuid, _enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.jobs
  SET mini_ad_enabled = _enabled
  WHERE id = _job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Job not found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 7. customer_set_job_mini_ad — customer can opt-in (paid add-on) on their own job
CREATE OR REPLACE FUNCTION public.customer_set_job_mini_ad(_job_id uuid, _enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.jobs
  SET mini_ad_enabled = _enabled,
      mini_ad_paid = CASE WHEN _enabled THEN true ELSE mini_ad_paid END
  WHERE id = _job_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Project not found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;
