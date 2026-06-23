
-- Add billing/activation columns to jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS share_unlocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flyer_active boolean NOT NULL DEFAULT true;

-- Backfill: any already-paid jobs unlock sharing
UPDATE public.jobs SET share_unlocked = true WHERE status = 'paid'::public.job_status AND share_unlocked = false;

-- Trigger: when status flips to 'paid', auto-unlock sharing
CREATE OR REPLACE FUNCTION public.jobs_sync_share_unlock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid'::public.job_status AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.share_unlocked := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_sync_share_unlock ON public.jobs;
CREATE TRIGGER trg_jobs_sync_share_unlock
BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.jobs_sync_share_unlock();

-- Customer RPC to toggle flyer_active (only when share_unlocked + owner)
-- Also flips the linked flyer's status between published/draft so the public link is disabled.
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
    UPDATE public.flyers
       SET status = CASE WHEN _active THEN 'published'::public.flyer_status ELSE 'draft'::public.flyer_status END
     WHERE id = v_flyer_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;
