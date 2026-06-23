-- Editor assignment workflow for customer jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS assigned_editor_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS editor_started_at timestamptz;

CREATE INDEX IF NOT EXISTS jobs_assigned_editor_idx ON public.jobs(assigned_editor_id);

-- Friendly display name for an assigned editor (email-based). SECURITY DEFINER so
-- customers / other editors can resolve who is working on a job without widening
-- profiles RLS.
CREATE OR REPLACE FUNCTION public.job_assigned_editor_display(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE id = _user_id;
$$;

REVOKE ALL ON FUNCTION public.job_assigned_editor_display(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.job_assigned_editor_display(uuid) TO authenticated, anon;

-- Atomic claim: only one editor can take a job.
CREATE OR REPLACE FUNCTION public.editor_claim_job(_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.jobs;
BEGIN
  IF NOT public.has_role(auth.uid(), 'editor'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.jobs
  SET
    assigned_editor_id = auth.uid(),
    assigned_at = now(),
    editor_started_at = COALESCE(editor_started_at, now()),
    status = CASE
      WHEN status IN ('new'::public.job_status, 'reviewing'::public.job_status, 'quoted'::public.job_status, 'paid'::public.job_status)
        THEN 'in_progress'::public.job_status
      ELSE status
    END
  WHERE id = _job_id
    AND deleted_at IS NULL
    AND assigned_editor_id IS NULL
  RETURNING * INTO _row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already assigned to another editor');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.editor_claim_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.editor_claim_job(uuid) TO authenticated;

-- Release: assigned editor or admin can release an assignment.
CREATE OR REPLACE FUNCTION public.editor_release_job(_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _assigned uuid;
BEGIN
  SELECT assigned_editor_id INTO _assigned FROM public.jobs WHERE id = _job_id;
  IF _assigned IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Job not assigned');
  END IF;
  IF NOT (auth.uid() = _assigned OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.jobs
  SET assigned_editor_id = NULL,
      assigned_at = NULL
  WHERE id = _job_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.editor_release_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.editor_release_job(uuid) TO authenticated;

-- Admin reassign helper.
CREATE OR REPLACE FUNCTION public.admin_assign_job_editor(_job_id uuid, _editor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _editor_id IS NOT NULL AND NOT public.has_role(_editor_id, 'editor'::public.app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User is not an editor');
  END IF;

  UPDATE public.jobs
  SET
    assigned_editor_id = _editor_id,
    assigned_at = CASE WHEN _editor_id IS NULL THEN NULL ELSE now() END
  WHERE id = _job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Job not found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assign_job_editor(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_job_editor(uuid, uuid) TO authenticated;

-- Tighten editor_update_job: only the assigned editor (or unassigned-claim flow) may update.
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
    preview_ready = COALESCE(_preview_ready, preview_ready)
  WHERE id = _job_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;