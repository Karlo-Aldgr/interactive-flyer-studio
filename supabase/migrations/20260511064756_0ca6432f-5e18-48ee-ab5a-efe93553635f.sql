-- Status enum
DO $$ BEGIN
  CREATE TYPE public.appointment_status AS ENUM ('confirmed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_id uuid NOT NULL,
  layer_id uuid,
  action_id uuid,
  name text,
  email text NOT NULL,
  phone text,
  note text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  timezone text,
  status public.appointment_status NOT NULL DEFAULT 'confirmed',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointments_flyer_start_idx ON public.appointments (flyer_id, start_at);
CREATE INDEX IF NOT EXISTS appointments_email_idx ON public.appointments (email);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Public can insert when the flyer is published
CREATE POLICY "anyone can book on published flyers"
ON public.appointments FOR INSERT TO anon, authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.flyers f
  WHERE f.id = appointments.flyer_id AND f.status = 'published'
));

-- Owner reads
CREATE POLICY "owner reads appointments"
ON public.appointments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.flyers f
  WHERE f.id = appointments.flyer_id AND f.owner_id = auth.uid()
));

-- Owner updates (e.g. cancel)
CREATE POLICY "owner updates appointments"
ON public.appointments FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.flyers f
  WHERE f.id = appointments.flyer_id AND f.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.flyers f
  WHERE f.id = appointments.flyer_id AND f.owner_id = auth.uid()
));

-- Owner deletes
CREATE POLICY "owner deletes appointments"
ON public.appointments FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.flyers f
  WHERE f.id = appointments.flyer_id AND f.owner_id = auth.uid()
));

-- Admins read
CREATE POLICY "admins read all appointments"
ON public.appointments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
DROP TRIGGER IF EXISTS appointments_set_updated_at ON public.appointments;
CREATE TRIGGER appointments_set_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();