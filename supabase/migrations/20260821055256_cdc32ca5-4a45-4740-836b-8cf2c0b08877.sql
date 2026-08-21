-- ============ Social Media Command Center ============
CREATE TYPE public.social_platform AS ENUM ('facebook','instagram','tiktok','linkedin','x','youtube');
CREATE TYPE public.social_connection_status AS ENUM ('connected','reconnect_required','permission_missing','revoked','error');
CREATE TYPE public.social_post_status AS ENUM ('draft','queued','publishing','published','partially_published','failed','cancelled');
CREATE TYPE public.social_variant_status AS ENUM ('draft','queued','publishing','published','failed','cancelled','skipped');
CREATE TYPE public.social_job_status AS ENUM ('pending','locked','running','succeeded','failed','cancelled');

-- 1. accounts -------------------------------------------------------------
CREATE TABLE public.social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform public.social_platform NOT NULL,
  platform_account_id text NOT NULL,
  account_name text,
  username text,
  profile_image_url text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}',
  connection_status public.social_connection_status NOT NULL DEFAULT 'connected',
  status_detail text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, platform_account_id)
);
CREATE INDEX social_accounts_user_idx ON public.social_accounts(user_id, platform);

-- Column-level grants: token columns are NEVER readable by the browser.
GRANT SELECT (id, user_id, platform, platform_account_id, account_name, username,
  profile_image_url, token_expires_at, scopes, connection_status, status_detail,
  connected_at, last_synced_at, metadata, created_at, updated_at)
  ON public.social_accounts TO authenticated;
GRANT DELETE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts read" ON public.social_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own accounts delete" ON public.social_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. oauth states (service-role only) -------------------------------------
CREATE TABLE public.social_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform public.social_platform NOT NULL,
  redirect_path text NOT NULL DEFAULT '/dashboard/social',
  code_verifier text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX social_oauth_states_expiry_idx ON public.social_oauth_states(expires_at);
GRANT ALL ON public.social_oauth_states TO service_role;
ALTER TABLE public.social_oauth_states ENABLE ROW LEVEL SECURITY;

-- 3. posts ----------------------------------------------------------------
CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flyer_id uuid REFERENCES public.flyers(id) ON DELETE SET NULL,
  title text,
  content text NOT NULL DEFAULT '',
  link_url text,
  hashtags text[] NOT NULL DEFAULT '{}',
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.social_post_status NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  schedule_timezone text,
  published_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX social_posts_user_idx ON public.social_posts(user_id, status, scheduled_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated;
GRANT ALL ON public.social_posts TO service_role;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own posts" ON public.social_posts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. variants --------------------------------------------------------------
CREATE TABLE public.social_post_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  social_account_id uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  platform public.social_platform NOT NULL,
  caption text NOT NULL DEFAULT '',
  hashtags text[] NOT NULL DEFAULT '{}',
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  link_url text,
  platform_options jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.social_variant_status NOT NULL DEFAULT 'draft',
  remote_post_id text,
  remote_post_url text,
  published_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, social_account_id)
);
CREATE INDEX social_post_variants_post_idx ON public.social_post_variants(post_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_post_variants TO authenticated;
GRANT ALL ON public.social_post_variants TO service_role;
ALTER TABLE public.social_post_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own variants" ON public.social_post_variants FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. assets ----------------------------------------------------------------
CREATE TABLE public.social_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text,
  mime_type text NOT NULL,
  byte_size bigint,
  kind text NOT NULL DEFAULT 'image',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, storage_path)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_media_assets TO authenticated;
GRANT ALL ON public.social_media_assets TO service_role;
ALTER TABLE public.social_media_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own assets" ON public.social_media_assets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. publish jobs -----------------------------------------------------------
CREATE TABLE public.social_publish_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.social_post_variants(id) ON DELETE CASCADE,
  social_account_id uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  platform public.social_platform NOT NULL,
  due_at timestamptz NOT NULL DEFAULT now(),
  status public.social_job_status NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  idempotency_key text NOT NULL,
  locked_at timestamptz,
  locked_by text,
  next_attempt_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);
CREATE INDEX social_publish_jobs_due_idx ON public.social_publish_jobs(status, due_at);
GRANT SELECT, DELETE ON public.social_publish_jobs TO authenticated;
GRANT ALL ON public.social_publish_jobs TO service_role;
ALTER TABLE public.social_publish_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own jobs read" ON public.social_publish_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own jobs delete" ON public.social_publish_jobs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 7. analytics ---------------------------------------------------------------
CREATE TABLE public.social_post_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.social_posts(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.social_post_variants(id) ON DELETE CASCADE,
  social_account_id uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  platform public.social_platform NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  impressions bigint,
  reach bigint,
  engagements bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  clicks bigint,
  video_views bigint,
  platform_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX social_post_analytics_user_idx ON public.social_post_analytics(user_id, captured_at DESC);
GRANT SELECT ON public.social_post_analytics TO authenticated;
GRANT ALL ON public.social_post_analytics TO service_role;
ALTER TABLE public.social_post_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own analytics" ON public.social_post_analytics FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 8. platform settings (admin-managed global toggles) -------------------------
CREATE TABLE public.social_platform_settings (
  platform public.social_platform PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.social_platform_settings TO authenticated, anon;
GRANT ALL ON public.social_platform_settings TO service_role;
ALTER TABLE public.social_platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable" ON public.social_platform_settings FOR SELECT USING (true);
CREATE POLICY "admins manage settings" ON public.social_platform_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.social_platform_settings(platform) VALUES
  ('facebook'),('instagram'),('tiktok'),('linkedin'),('x'),('youtube');

-- updated_at triggers
CREATE TRIGGER social_accounts_updated BEFORE UPDATE ON public.social_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER social_posts_updated BEFORE UPDATE ON public.social_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER social_post_variants_updated BEFORE UPDATE ON public.social_post_variants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER social_publish_jobs_updated BEFORE UPDATE ON public.social_publish_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Safe metadata RPC (never returns token columns)
CREATE OR REPLACE FUNCTION public.my_social_accounts()
RETURNS TABLE (
  id uuid, platform public.social_platform, platform_account_id text, account_name text,
  username text, profile_image_url text, scopes text[], connection_status public.social_connection_status,
  status_detail text, connected_at timestamptz, last_synced_at timestamptz,
  token_expires_at timestamptz, metadata jsonb
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.platform, a.platform_account_id, a.account_name, a.username, a.profile_image_url,
         a.scopes, a.connection_status, a.status_detail, a.connected_at, a.last_synced_at,
         a.token_expires_at, a.metadata
  FROM public.social_accounts a
  WHERE a.user_id = auth.uid()
  ORDER BY a.platform, a.connected_at;
$$;
GRANT EXECUTE ON FUNCTION public.my_social_accounts() TO authenticated;

-- Admin overview (counts only, no tokens/secrets)
CREATE OR REPLACE FUNCTION public.admin_social_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT jsonb_build_object(
    'accounts', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT platform, connection_status, count(*)::int AS count
        FROM public.social_accounts GROUP BY 1,2) x),
    'jobs', (SELECT coalesce(jsonb_agg(y), '[]'::jsonb) FROM (
        SELECT status, count(*)::int AS count FROM public.social_publish_jobs GROUP BY 1) y),
    'posts', (SELECT coalesce(jsonb_agg(z), '[]'::jsonb) FROM (
        SELECT status, count(*)::int AS count FROM public.social_posts GROUP BY 1) z),
    'settings', (SELECT coalesce(jsonb_agg(s), '[]'::jsonb) FROM (
        SELECT platform, enabled, notes FROM public.social_platform_settings ORDER BY platform) s)
  ) INTO result;
  RETURN result;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_social_overview() TO authenticated;

-- onboarding: remember the social step was seen / skipped
ALTER TABLE public.onboarding_submissions
  ADD COLUMN IF NOT EXISTS social_step_status text NOT NULL DEFAULT 'not_seen',
  ADD COLUMN IF NOT EXISTS social_step_seen_at timestamptz;