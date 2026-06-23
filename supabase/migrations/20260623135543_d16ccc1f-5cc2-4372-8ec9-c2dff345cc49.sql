
-- Helper to ensure a flyer has a public_slug
CREATE OR REPLACE FUNCTION public.ensure_flyer_public_slug(_flyer_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_title text;
  v_base text;
  v_candidate text;
  v_n int := 0;
BEGIN
  SELECT public_slug, title INTO v_slug, v_title FROM public.flyers WHERE id = _flyer_id;
  IF v_slug IS NOT NULL AND length(v_slug) > 0 THEN
    RETURN v_slug;
  END IF;

  v_base := lower(regexp_replace(coalesce(nullif(trim(v_title), ''), 'flyer'), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);
  IF v_base IS NULL OR length(v_base) = 0 THEN v_base := 'flyer'; END IF;
  IF length(v_base) > 40 THEN v_base := substring(v_base from 1 for 40); END IF;

  v_candidate := v_base || '-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6);
  WHILE EXISTS (SELECT 1 FROM public.flyers WHERE public_slug = v_candidate) AND v_n < 5 LOOP
    v_candidate := v_base || '-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6);
    v_n := v_n + 1;
  END LOOP;

  UPDATE public.flyers SET public_slug = v_candidate WHERE id = _flyer_id;
  RETURN v_candidate;
END;
$$;

-- Update jobs share-unlock trigger to also ensure slug on linked flyer
CREATE OR REPLACE FUNCTION public.jobs_sync_share_unlock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid'::public.job_status AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.share_unlocked := true;
  END IF;
  IF NEW.share_unlocked = true AND NEW.flyer_id IS NOT NULL THEN
    PERFORM public.ensure_flyer_public_slug(NEW.flyer_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Update customer_set_flyer_active to ensure slug exists before going active
CREATE OR REPLACE FUNCTION public.customer_set_flyer_active(_job_id uuid, _active boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flyer_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT flyer_id INTO v_flyer_id
  FROM public.jobs
  WHERE id = _job_id
    AND user_id = auth.uid()
    AND share_unlocked = true
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sharing is not unlocked for this project yet');
  END IF;

  UPDATE public.jobs SET flyer_active = _active WHERE id = _job_id;

  IF v_flyer_id IS NOT NULL THEN
    IF _active THEN
      PERFORM public.ensure_flyer_public_slug(v_flyer_id);
    END IF;
    UPDATE public.flyers
       SET status = CASE WHEN _active THEN 'published'::public.flyer_status ELSE 'draft'::public.flyer_status END
     WHERE id = v_flyer_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Backfill: ensure all already-unlocked jobs have a slug on their flyer
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT flyer_id FROM public.jobs WHERE share_unlocked = true AND flyer_id IS NOT NULL LOOP
    PERFORM public.ensure_flyer_public_slug(r.flyer_id);
  END LOOP;
END $$;
