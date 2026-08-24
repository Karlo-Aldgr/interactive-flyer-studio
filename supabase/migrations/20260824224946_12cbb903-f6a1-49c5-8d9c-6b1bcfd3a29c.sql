ALTER TABLE public.flyers
  ADD COLUMN IF NOT EXISTS website_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS website_slug text;

ALTER TABLE public.flyers DROP CONSTRAINT IF EXISTS flyers_website_status_check;
ALTER TABLE public.flyers ADD CONSTRAINT flyers_website_status_check CHECK (website_status IN ('draft','published'));

CREATE UNIQUE INDEX IF NOT EXISTS flyers_website_slug_key ON public.flyers (website_slug) WHERE website_slug IS NOT NULL;

-- Public read access limited to the WEBSITE page of flyers whose website is published.
DROP POLICY IF EXISTS "anyone reads published website pages" ON public.pages;
CREATE POLICY "anyone reads published website pages" ON public.pages FOR SELECT TO anon, authenticated
  USING (
    coalesce((background ->> 'websitePage')::boolean, false)
    AND EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = pages.flyer_id AND f.website_status = 'published')
  );

DROP POLICY IF EXISTS "anyone reads published website layers" ON public.layers;
CREATE POLICY "anyone reads published website layers" ON public.layers FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pages p JOIN public.flyers f ON f.id = p.flyer_id
    WHERE p.id = layers.page_id
      AND coalesce((p.background ->> 'websitePage')::boolean, false)
      AND f.website_status = 'published'
  ));

DROP POLICY IF EXISTS "anyone reads published website actions" ON public.actions;
CREATE POLICY "anyone reads published website actions" ON public.actions FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.layers l
    JOIN public.pages p ON p.id = l.page_id
    JOIN public.flyers f ON f.id = p.flyer_id
    WHERE l.id = actions.layer_id
      AND coalesce((p.background ->> 'websitePage')::boolean, false)
      AND f.website_status = 'published'
  ));