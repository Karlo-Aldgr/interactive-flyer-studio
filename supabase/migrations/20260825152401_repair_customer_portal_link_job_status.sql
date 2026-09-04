-- Restore the customer portal authorization helper with the canonical terminal
-- job status. In the job_status enum, customer-facing "Completed" is stored as
-- "delivered"; there is no "completed" enum value.

CREATE OR REPLACE FUNCTION public.user_can_access_customer_flyer_portal(_flyer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.flyers f
    WHERE f.id = _flyer_id
      AND f.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.flyer_id = _flyer_id
      AND j.user_id = auth.uid()
      AND j.deleted_at IS NULL
      AND (
        j.share_unlocked = true
        OR j.status IN ('paid'::public.job_status, 'delivered'::public.job_status)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_access_customer_flyer_portal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_customer_flyer_portal(uuid) TO authenticated;

SET check_function_bodies = on;
