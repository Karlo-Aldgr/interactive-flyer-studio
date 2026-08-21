-- Digital business card (bizad) — one per flyer, public when enabled.

CREATE TABLE public.bizads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_id uuid NOT NULL UNIQUE REFERENCES public.flyers(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  slug text NOT NULL UNIQUE,
  business_name text,
  owner_name text,
  phone text,
  email text,
  about_text text,
  flyer_image_url text,
  owner_photo_url text,
  logo_url text,
  address text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  button_color text NOT NULL DEFAULT '#2563eb',
  background_color text NOT NULL DEFAULT '#ffffff',
  gallery_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bizads_slug_idx ON public.bizads (slug) WHERE enabled = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bizads TO authenticated;
GRANT SELECT ON public.bizads TO anon;
GRANT ALL ON public.bizads TO service_role;

ALTER TABLE public.bizads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view enabled bizads"
  ON public.bizads FOR SELECT
  TO anon, authenticated
  USING (enabled = true);

CREATE POLICY "Flyer editors can view bizads"
  ON public.bizads FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.current_user_can_edit()
  );

CREATE POLICY "Flyer editors can insert bizads"
  ON public.bizads FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.current_user_can_edit()
  );

CREATE POLICY "Flyer editors can update bizads"
  ON public.bizads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.current_user_can_edit()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.current_user_can_edit()
  );

CREATE POLICY "Flyer editors can delete bizads"
  ON public.bizads FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.current_user_can_edit()
  );

COMMENT ON TABLE public.bizads IS 'Mobile digital business card page linked to a flyer.';
