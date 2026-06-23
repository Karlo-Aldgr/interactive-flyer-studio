CREATE OR REPLACE FUNCTION public.job_assigned_editor_display(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT p.email INTO _email
  FROM public.profiles p
  WHERE p.id = _user_id;

  IF _email IS NULL THEN
    SELECT u.email::text INTO _email
    FROM auth.users u
    WHERE u.id = _user_id;
  END IF;

  RETURN _email;
END;
$$;

REVOKE ALL ON FUNCTION public.job_assigned_editor_display(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_assigned_editor_display(uuid) TO authenticated;

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
    assigned_at = CASE WHEN _editor_id IS NULL THEN NULL ELSE COALESCE(assigned_at, now()) END,
    editor_started_at = CASE WHEN _editor_id IS NULL THEN editor_started_at ELSE COALESCE(editor_started_at, now()) END
  WHERE id = _job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Job not found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assign_job_editor(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_job_editor(uuid, uuid) TO authenticated;

DO $$
DECLARE
  _only_editor uuid;
BEGIN
  SELECT ur.user_id INTO _only_editor
  FROM public.user_roles ur
  WHERE ur.role = 'editor'::public.app_role
  GROUP BY ur.user_id
  HAVING (SELECT count(*) FROM public.user_roles WHERE role = 'editor'::public.app_role) = 1
  LIMIT 1;

  IF _only_editor IS NOT NULL THEN
    UPDATE public.jobs
    SET
      assigned_editor_id = _only_editor,
      assigned_at = COALESCE(staff_content_seen_at, updated_at, created_at, now()),
      editor_started_at = COALESCE(editor_started_at, staff_content_seen_at, updated_at, created_at, now())
    WHERE assigned_editor_id IS NULL
      AND deleted_at IS NULL
      AND status IN ('in_progress'::public.job_status, 'preview_ready'::public.job_status, 'delivered'::public.job_status);
  END IF;
END;
$$;