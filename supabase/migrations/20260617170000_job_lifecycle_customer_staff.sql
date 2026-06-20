-- Customer soft-delete, edit tracking, and staff acknowledge flows.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS customer_deletion_reason text,
  ADD COLUMN IF NOT EXISTS staff_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS staff_acknowledged_by uuid,
  ADD COLUMN IF NOT EXISTS customer_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS staff_content_seen_at timestamptz;

-- Customers only see active (non-deleted) own jobs.
DROP POLICY IF EXISTS "users see own jobs" ON public.jobs;
CREATE POLICY "users see own jobs"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Editors: active jobs + customer-deleted jobs not yet acknowledged.
DROP POLICY IF EXISTS "editors read jobs" ON public.jobs;
CREATE POLICY "editors read jobs"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'editor'::public.app_role)
    AND (
      deleted_at IS NULL
      OR staff_acknowledged_at IS NULL
    )
  );

-- Admins: same visibility rule for deleted queue hygiene.
DROP POLICY IF EXISTS "admins read all jobs" ON public.jobs;
CREATE POLICY "admins read all jobs"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND (
      deleted_at IS NULL
      OR staff_acknowledged_at IS NULL
    )
  );

CREATE OR REPLACE FUNCTION public.customer_delete_job(
  _job_id uuid,
  _reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please provide a reason');
  END IF;

  UPDATE public.jobs
  SET
    deleted_at = now(),
    deleted_by = auth.uid(),
    customer_deletion_reason = trim(_reason),
    status = 'cancelled'::public.job_status
  WHERE id = _job_id
    AND user_id = auth.uid()
    AND deleted_at IS NULL
    AND status NOT IN ('delivered'::public.job_status);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Project not found or cannot be deleted');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_update_job(
  _job_id uuid,
  _title text DEFAULT NULL,
  _brief text DEFAULT NULL,
  _selected_actions jsonb DEFAULT NULL,
  _upload_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.jobs
    WHERE id = _job_id
      AND user_id = auth.uid()
      AND deleted_at IS NULL
      AND status NOT IN ('delivered'::public.job_status, 'cancelled'::public.job_status)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Project not found or cannot be edited');
  END IF;

  IF _title IS NOT NULL AND length(trim(_title)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Title cannot be empty');
  END IF;

  UPDATE public.jobs
  SET
    title = COALESCE(NULLIF(trim(_title), ''), title),
    brief = CASE WHEN _brief IS NOT NULL THEN NULLIF(trim(_brief), '') ELSE brief END,
    selected_actions = COALESCE(_selected_actions, selected_actions),
    upload_url = COALESCE(_upload_url, upload_url),
    customer_updated_at = now(),
    status = CASE
      WHEN status IN ('in_progress'::public.job_status, 'preview_ready'::public.job_status)
        THEN 'reviewing'::public.job_status
      ELSE status
    END
  WHERE id = _job_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_acknowledge_job(_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'editor'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.jobs
  SET
    staff_acknowledged_at = now(),
    staff_acknowledged_by = auth.uid()
  WHERE id = _job_id
    AND deleted_at IS NOT NULL
    AND staff_acknowledged_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nothing to acknowledge');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_mark_job_seen(_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'editor'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.jobs
  SET staff_content_seen_at = now()
  WHERE id = _job_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Job not found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.customer_delete_job(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.customer_update_job(uuid, text, text, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_acknowledge_job(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_mark_job_seen(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.customer_delete_job(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_update_job(uuid, text, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_acknowledge_job(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_mark_job_seen(uuid) TO authenticated;
