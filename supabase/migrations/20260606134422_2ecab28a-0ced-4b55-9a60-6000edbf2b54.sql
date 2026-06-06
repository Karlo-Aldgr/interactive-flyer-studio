CREATE TABLE public.example_flyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  title text NOT NULL,
  description text,
  thumbnail_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.example_flyers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.example_flyers TO authenticated;
GRANT ALL ON public.example_flyers TO service_role;

ALTER TABLE public.example_flyers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view examples"
  ON public.example_flyers FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert examples"
  ON public.example_flyers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update examples"
  ON public.example_flyers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete examples"
  ON public.example_flyers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER example_flyers_set_updated_at
  BEFORE UPDATE ON public.example_flyers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();