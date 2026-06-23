CREATE OR REPLACE FUNCTION public.editor_update_job(_job_id uuid, _status job_status DEFAULT NULL::job_status, _flyer_id uuid DEFAULT NULL::uuid, _preview_ready boolean DEFAULT NULL::boolean, _clear_flyer boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _allowed_statuses public.job_status[] := ARRAY[
    'reviewing'::public.job_status,
    'in_progress'::public.job_status,
    'preview_ready'::public.job_status,
    'delivered'::public.job_status
  ];
  _assigned uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'editor'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT assigned_editor_id INTO _assigned FROM public.jobs WHERE id = _job_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Job not found');
  END IF;

  IF _assigned IS NOT NULL AND _assigned <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Assigned to another editor');
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
    preview_ready = COALESCE(_preview_ready, preview_ready),
    assigned_editor_id = COALESCE(assigned_editor_id, auth.uid()),
    assigned_at = COALESCE(assigned_at, now()),
    editor_started_at = COALESCE(editor_started_at, now())
  WHERE id = _job_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;