DROP POLICY IF EXISTS "update own session rating" ON public.business_ratings;
REVOKE UPDATE ON public.business_ratings FROM anon;