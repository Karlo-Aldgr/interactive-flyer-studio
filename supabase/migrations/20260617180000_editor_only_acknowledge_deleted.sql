-- Only editors may acknowledge customer-deleted jobs (clears queue for editor + admin).

CREATE OR REPLACE FUNCTION public.staff_acknowledge_job(_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'editor'::public.app_role) THEN
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
