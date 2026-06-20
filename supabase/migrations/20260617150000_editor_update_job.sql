-- Phase 2: Editors may update limited job fields (status, flyer link, preview flag).
CREATE OR REPLACE FUNCTION public.editor_update_job(
  _job_id uuid,
  _status public.job_status DEFAULT NULL,
  _flyer_id uuid DEFAULT NULL,
  _preview_ready boolean DEFAULT NULL,
  _clear_flyer boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _allowed_statuses public.job_status[] := ARRAY[
    'reviewing'::public.job_status,
    'in_progress'::public.job_status,
    'preview_ready'::public.job_status,
    'delivered'::public.job_status
  ];
BEGIN
  IF NOT public.has_role(auth.uid(), 'editor'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.jobs WHERE id = _job_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Job not found');
  END IF;

  IF _status IS NOT NULL AND NOT (_status = ANY (_allowed_statuses)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Status not allowed for editors');
  END IF;

  IF _clear_flyer THEN
    _flyer_id := NULL;
  ELSIF _flyer_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.flyers
      WHERE id = _flyer_id AND owner_id = auth.uid()
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Flyer must be one you own');
    END IF;
  END IF;

  UPDATE public.jobs
  SET
    status = COALESCE(_status, status),
    flyer_id = CASE
      WHEN _clear_flyer THEN NULL
      WHEN _flyer_id IS NOT NULL THEN _flyer_id
      ELSE flyer_id
    END,
    preview_ready = COALESCE(_preview_ready, preview_ready)
  WHERE id = _job_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.editor_update_job(uuid, public.job_status, uuid, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.editor_update_job(uuid, public.job_status, uuid, boolean, boolean) TO authenticated;
