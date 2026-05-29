
-- 1. Tighten flyer-thumbnails storage policies — remove broad ones, rely on owner-scoped + bucket public flag
DROP POLICY IF EXISTS "Allow all thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Owner can upload" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public read flyer thumbnails" ON storage.objects;

-- 2. Make job-uploads private and restrict reads to owner folder + admins
UPDATE storage.buckets SET public = false WHERE id = 'job-uploads';
DROP POLICY IF EXISTS "anyone read job-uploads" ON storage.objects;

CREATE POLICY "owner reads own job-uploads"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'job-uploads'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "admins read all job-uploads"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'job-uploads' AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- 3. Move flyer portal secrets out of the publicly-readable flyers row
CREATE TABLE public.flyer_portal_credentials (
  flyer_id uuid PRIMARY KEY,
  portal_token uuid NOT NULL DEFAULT gen_random_uuid(),
  portal_access_code text NOT NULL DEFAULT upper(substr(replace((gen_random_uuid())::text, '-', ''), 1, 6)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flyer_portal_credentials TO authenticated;
GRANT ALL ON public.flyer_portal_credentials TO service_role;

ALTER TABLE public.flyer_portal_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner full access portal credentials"
ON public.flyer_portal_credentials FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_portal_credentials.flyer_id AND f.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_portal_credentials.flyer_id AND f.owner_id = auth.uid()));

CREATE POLICY "admins read all portal credentials"
ON public.flyer_portal_credentials FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_flyer_portal_credentials_updated_at
BEFORE UPDATE ON public.flyer_portal_credentials
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Migrate existing values then drop the now-private columns from flyers
INSERT INTO public.flyer_portal_credentials (flyer_id, portal_token, portal_access_code)
SELECT id, portal_token, portal_access_code FROM public.flyers
ON CONFLICT (flyer_id) DO NOTHING;

-- Auto-create a credentials row for new flyers
CREATE OR REPLACE FUNCTION public.create_flyer_portal_credentials()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.flyer_portal_credentials (flyer_id)
  VALUES (NEW.id)
  ON CONFLICT (flyer_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER flyers_create_portal_credentials
AFTER INSERT ON public.flyers
FOR EACH ROW EXECUTE FUNCTION public.create_flyer_portal_credentials();

ALTER TABLE public.flyers DROP COLUMN portal_token;
ALTER TABLE public.flyers DROP COLUMN portal_access_code;

-- 4. Scope realtime channel subscriptions to known topic patterns the app uses
CREATE POLICY "scoped realtime topic reads"
ON realtime.messages FOR SELECT TO anon, authenticated
USING (
  realtime.topic() LIKE 'poll-%'
  OR realtime.topic() LIKE 'flyer-votes-%'
);

-- 5. Revoke direct EXECUTE on SECURITY DEFINER functions that are not meant to be called from the API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unpublish_expired_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flyers_sync_auto_unpublish() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_flyer_portal_credentials() FROM PUBLIC, anon, authenticated;
