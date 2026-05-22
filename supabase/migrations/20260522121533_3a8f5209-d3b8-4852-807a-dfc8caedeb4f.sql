
-- Extend action_type enum
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'survey';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'testimonial';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'reserve_table';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'schedule_consultation';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'show_menu';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'join_challenge';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'business_rating';

-- Survey responses
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_id uuid NOT NULL,
  action_id uuid,
  session_id text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone submits survey on published flyers" ON public.survey_responses FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.status = 'published'));
CREATE POLICY "owner reads survey responses" ON public.survey_responses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid()));
CREATE POLICY "admins read all surveys" ON public.survey_responses FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Testimonials
CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_id uuid NOT NULL,
  action_id uuid,
  name text,
  rating int CHECK (rating BETWEEN 1 AND 5),
  body text,
  photo_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone submits testimonial on published" ON public.testimonials FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.status = 'published') AND status = 'pending');
CREATE POLICY "anyone reads approved testimonials" ON public.testimonials FOR SELECT TO anon, authenticated
  USING (status = 'approved' AND EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.status = 'published'));
CREATE POLICY "owner reads all testimonials" ON public.testimonials FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid()));
CREATE POLICY "owner updates testimonials" ON public.testimonials FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid()));
CREATE POLICY "owner deletes testimonials" ON public.testimonials FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid()));
CREATE POLICY "admins read all testimonials" ON public.testimonials FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER testimonials_updated_at BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Table reservations
CREATE TABLE IF NOT EXISTS public.table_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_id uuid NOT NULL,
  action_id uuid,
  reserve_at timestamptz NOT NULL,
  party_size int NOT NULL DEFAULT 2,
  name text NOT NULL,
  phone text,
  email text,
  notes text,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.table_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reserves on published" ON public.table_reservations FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.status = 'published'));
CREATE POLICY "owner reads reservations" ON public.table_reservations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid()));
CREATE POLICY "owner updates reservations" ON public.table_reservations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid()));
CREATE POLICY "owner deletes reservations" ON public.table_reservations FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid()));
CREATE POLICY "admins read all reservations" ON public.table_reservations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER table_reservations_updated_at BEFORE UPDATE ON public.table_reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Menus
CREATE TABLE IF NOT EXISTS public.menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_id uuid NOT NULL,
  action_id uuid NOT NULL UNIQUE,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads menus of published" ON public.menus FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.status = 'published'));
CREATE POLICY "owner full access menus" ON public.menus FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid()));
CREATE TRIGGER menus_updated_at BEFORE UPDATE ON public.menus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Challenge participants
CREATE TABLE IF NOT EXISTS public.challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_id uuid NOT NULL,
  action_id uuid,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone joins challenge on published" ON public.challenge_participants FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.status = 'published'));
CREATE POLICY "owner reads participants" ON public.challenge_participants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid()));
CREATE POLICY "admins read participants" ON public.challenge_participants FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Business ratings
CREATE TABLE IF NOT EXISTS public.business_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_id uuid NOT NULL,
  action_id uuid,
  session_id text NOT NULL,
  stars int NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS business_ratings_unique_session
  ON public.business_ratings (flyer_id, action_id, session_id);
ALTER TABLE public.business_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads ratings of published" ON public.business_ratings FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.status = 'published'));
CREATE POLICY "anyone rates published" ON public.business_ratings FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.status = 'published'));
CREATE POLICY "anyone updates own session rating" ON public.business_ratings FOR UPDATE TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.status = 'published'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.status = 'published'));
CREATE POLICY "owner reads all ratings" ON public.business_ratings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid()));
CREATE POLICY "admins read all ratings" ON public.business_ratings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER business_ratings_updated_at BEFORE UPDATE ON public.business_ratings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
