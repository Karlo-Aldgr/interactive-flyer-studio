CREATE POLICY "anyone can read website-published flyers"
ON public.flyers FOR SELECT
TO anon, authenticated
USING (website_status = 'published');

CREATE OR REPLACE FUNCTION public.website_slug_available(_slug text, _flyer_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.flyers f
    WHERE f.website_slug = _slug
      AND (_flyer_id IS NULL OR f.id <> _flyer_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.website_slug_available(text, uuid) TO authenticated, service_role;