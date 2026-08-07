CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'API key',
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['publish']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE UNIQUE INDEX api_keys_key_hash_idx ON public.api_keys(key_hash);
CREATE INDEX api_keys_owner_idx ON public.api_keys(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins read keys" ON public.api_keys
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Owners create own keys" ON public.api_keys
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners and admins update keys" ON public.api_keys
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Owners and admins delete keys" ON public.api_keys
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Hide the hash from client reads: expose a safe view without key_hash.
REVOKE SELECT (key_hash) ON public.api_keys FROM authenticated;

CREATE TABLE public.api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL DEFAULT gen_random_uuid(),
  key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  key_prefix text,
  owner_id uuid,
  endpoint text NOT NULL,
  platforms text[] NOT NULL DEFAULT ARRAY[]::text[],
  media_type text,
  status text NOT NULL,
  duration_ms integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX api_request_logs_key_created_idx ON public.api_request_logs(key_id, created_at DESC);
CREATE INDEX api_request_logs_owner_created_idx ON public.api_request_logs(owner_id, created_at DESC);

GRANT SELECT ON public.api_request_logs TO authenticated;
GRANT ALL ON public.api_request_logs TO service_role;

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins read api logs" ON public.api_request_logs
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.tiktok_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  open_id text,
  username text,
  status text NOT NULL DEFAULT 'connected',
  last_error text,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, DELETE ON public.tiktok_connections TO authenticated;
GRANT ALL ON public.tiktok_connections TO service_role;

ALTER TABLE public.tiktok_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own tiktok connection" ON public.tiktok_connections
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own tiktok connection" ON public.tiktok_connections
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER tiktok_connections_set_updated_at
  BEFORE UPDATE ON public.tiktok_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tiktok_connection_secrets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.tiktok_connection_secrets TO service_role;
ALTER TABLE public.tiktok_connection_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tiktok_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  return_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes'
);

GRANT ALL ON public.tiktok_oauth_states TO service_role;
ALTER TABLE public.tiktok_oauth_states ENABLE ROW LEVEL SECURITY;