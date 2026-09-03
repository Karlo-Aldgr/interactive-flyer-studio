-- Intentionally timestamped before the first historical use in
-- 20260628223917_f1d23c1b-daee-4a07-9ce4-5983960e40a7.sql. This additive
-- prerequisite repairs fresh-database ordering without rewriting migrations
-- that may already have been applied elsewhere.
CREATE OR REPLACE FUNCTION public.user_can_manage_flyer(_flyer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.flyers f
    WHERE f.id = _flyer_id
      AND (
        f.owner_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.current_user_can_edit()
      )
  );
$function$;
