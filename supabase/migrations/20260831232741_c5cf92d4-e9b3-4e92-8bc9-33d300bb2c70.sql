CREATE TABLE public.zernio_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  zernio_profile_id text NOT NULL,
  profile_name text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX zernio_profiles_user_active_uidx
  ON public.zernio_profiles (user_id) WHERE status = 'active';
CREATE UNIQUE INDEX zernio_profiles_remote_uidx
  ON public.zernio_profiles (zernio_profile_id);

GRANT SELECT ON public.zernio_profiles TO authenticated;
GRANT ALL ON public.zernio_profiles TO service_role;
ALTER TABLE public.zernio_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients read own zernio profile" ON public.zernio_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.zernio_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.zernio_profiles(id) ON DELETE CASCADE,
  zernio_profile_id text NOT NULL,
  zernio_account_id text NOT NULL,
  platform text NOT NULL,
  account_name text,
  username text,
  avatar_url text,
  status text NOT NULL DEFAULT 'connected',
  status_detail text,
  connected_at timestamptz,
  last_synced_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX zernio_accounts_remote_uidx
  ON public.zernio_accounts (zernio_profile_id, zernio_account_id);
CREATE INDEX zernio_accounts_user_idx ON public.zernio_accounts (user_id);

GRANT SELECT ON public.zernio_accounts TO authenticated;
GRANT ALL ON public.zernio_accounts TO service_role;
ALTER TABLE public.zernio_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients read own zernio accounts" ON public.zernio_accounts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.zernio_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  operation text NOT NULL,
  zernio_profile_id text,
  zernio_account_id text,
  platform text,
  success boolean NOT NULL DEFAULT true,
  http_status integer,
  error_category text,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX zernio_events_user_idx ON public.zernio_events (user_id, created_at DESC);

GRANT SELECT ON public.zernio_events TO authenticated;
GRANT ALL ON public.zernio_events TO service_role;
ALTER TABLE public.zernio_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients read own zernio events" ON public.zernio_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER zernio_profiles_set_updated_at BEFORE UPDATE ON public.zernio_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER zernio_accounts_set_updated_at BEFORE UPDATE ON public.zernio_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.admin_zernio_overview()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  zernio_profile_id text,
  profile_name text,
  profile_status text,
  accounts jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id,
         pr.email,
         pr.full_name,
         p.zernio_profile_id,
         p.profile_name,
         p.status,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'id', a.id,
             'platform', a.platform,
             'account_name', a.account_name,
             'username', a.username,
             'avatar_url', a.avatar_url,
             'status', a.status,
             'last_synced_at', a.last_synced_at
           ) ORDER BY a.platform)
           FROM public.zernio_accounts a WHERE a.profile_id = p.id
         ), '[]'::jsonb)
  FROM public.zernio_profiles p
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY pr.email NULLS LAST;
$$;
