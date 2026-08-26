-- ---------- client status ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_status text NOT NULL DEFAULT 'active';

-- ---------- helper ----------
CREATE OR REPLACE FUNCTION public.marketing_can_manage(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (public.has_role(auth.uid(), 'admin'::public.app_role)
          OR (_client_id IS NOT NULL AND _client_id = auth.uid()))
$$;

-- ---------- subscribers ----------
CREATE TABLE IF NOT EXISTS public.marketing_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text,
  last_name text,
  phone text,
  status text NOT NULL DEFAULT 'active',
  source text NOT NULL DEFAULT 'manual',
  flyer_id uuid REFERENCES public.flyers(id) ON DELETE SET NULL,
  flyer_name text,
  signup_location text,
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_subscribers_client_email_uniq
  ON public.marketing_subscribers (coalesce(client_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(email));
CREATE INDEX IF NOT EXISTS marketing_subscribers_client_created_idx
  ON public.marketing_subscribers (client_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_subscribers_token_uniq
  ON public.marketing_subscribers (unsubscribe_token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_subscribers TO authenticated;
GRANT ALL ON public.marketing_subscribers TO service_role;
ALTER TABLE public.marketing_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketing subscribers manage" ON public.marketing_subscribers
  FOR ALL TO authenticated
  USING (public.marketing_can_manage(client_id))
  WITH CHECK (public.marketing_can_manage(client_id));

CREATE TRIGGER marketing_subscribers_set_updated_at
  BEFORE UPDATE ON public.marketing_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- subscriber activity ----------
CREATE TABLE IF NOT EXISTS public.marketing_subscriber_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES public.marketing_subscribers(id) ON DELETE CASCADE,
  client_id uuid,
  event_type text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_events_subscriber_idx
  ON public.marketing_subscriber_events (subscriber_id, created_at DESC);

GRANT SELECT, INSERT ON public.marketing_subscriber_events TO authenticated;
GRANT ALL ON public.marketing_subscriber_events TO service_role;
ALTER TABLE public.marketing_subscriber_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketing events read" ON public.marketing_subscriber_events
  FOR SELECT TO authenticated USING (public.marketing_can_manage(client_id));
CREATE POLICY "marketing events insert" ON public.marketing_subscriber_events
  FOR INSERT TO authenticated WITH CHECK (public.marketing_can_manage(client_id));

-- ---------- tags ----------
CREATE TABLE IF NOT EXISTS public.marketing_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_tags_client_name_uniq
  ON public.marketing_tags (coalesce(client_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_tags TO authenticated;
GRANT ALL ON public.marketing_tags TO service_role;
ALTER TABLE public.marketing_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketing tags manage" ON public.marketing_tags
  FOR ALL TO authenticated
  USING (public.marketing_can_manage(client_id))
  WITH CHECK (public.marketing_can_manage(client_id));

-- ---------- settings / welcome email ----------
CREATE TABLE IF NOT EXISTS public.marketing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  business_name text,
  from_name text,
  reply_to text,
  welcome_enabled boolean NOT NULL DEFAULT true,
  welcome_subject text NOT NULL DEFAULT 'Welcome to {{business_name}}!',
  welcome_body text NOT NULL DEFAULT 'Hi {{first_name}},

Thanks for subscribing to {{business_name}}.

We''ll keep you updated with our latest news, offers, announcements, and useful updates.

We look forward to keeping in touch.

{{business_name}}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_settings_client_uniq
  ON public.marketing_settings (coalesce(client_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE ON public.marketing_settings TO authenticated;
GRANT ALL ON public.marketing_settings TO service_role;
ALTER TABLE public.marketing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketing settings manage" ON public.marketing_settings
  FOR ALL TO authenticated
  USING (public.marketing_can_manage(client_id))
  WITH CHECK (public.marketing_can_manage(client_id));

CREATE TRIGGER marketing_settings_set_updated_at
  BEFORE UPDATE ON public.marketing_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- audiences ----------
CREATE TABLE IF NOT EXISTS public.marketing_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  scope text NOT NULL DEFAULT 'subscriber',
  name text NOT NULL,
  description text,
  rules jsonb NOT NULL DEFAULT '{"match":"all","conditions":[]}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_audiences_client_idx ON public.marketing_audiences (client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_audiences TO authenticated;
GRANT ALL ON public.marketing_audiences TO service_role;
ALTER TABLE public.marketing_audiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketing audiences manage" ON public.marketing_audiences
  FOR ALL TO authenticated
  USING (public.marketing_can_manage(client_id))
  WITH CHECK (public.marketing_can_manage(client_id));

CREATE TRIGGER marketing_audiences_set_updated_at
  BEFORE UPDATE ON public.marketing_audiences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- campaigns ----------
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  name text NOT NULL,
  campaign_type text NOT NULL DEFAULT 'newsletter',
  channel text NOT NULL DEFAULT 'email',
  audience_id uuid REFERENCES public.marketing_audiences(id) ON DELETE SET NULL,
  audience_label text,
  audience_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipient_count integer NOT NULL DEFAULT 0,
  subject text,
  body text,
  media_url text,
  cta_text text,
  cta_url text,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_campaigns_client_idx
  ON public.marketing_campaigns (client_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaigns TO authenticated;
GRANT ALL ON public.marketing_campaigns TO service_role;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketing campaigns manage" ON public.marketing_campaigns
  FOR ALL TO authenticated
  USING (public.marketing_can_manage(client_id))
  WITH CHECK (public.marketing_can_manage(client_id));

CREATE TRIGGER marketing_campaigns_set_updated_at
  BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- email log ----------
CREATE TABLE IF NOT EXISTS public.marketing_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  subscriber_id uuid REFERENCES public.marketing_subscribers(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  email_type text NOT NULL DEFAULT 'welcome',
  subject text,
  status text NOT NULL DEFAULT 'queued',
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_email_log_client_idx
  ON public.marketing_email_log (client_id, created_at DESC);

GRANT SELECT ON public.marketing_email_log TO authenticated;
GRANT ALL ON public.marketing_email_log TO service_role;
ALTER TABLE public.marketing_email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketing email log read" ON public.marketing_email_log
  FOR SELECT TO authenticated USING (public.marketing_can_manage(client_id));

-- ---------- admin overview ----------
CREATE OR REPLACE FUNCTION public.marketing_admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jsonb_build_object(
    'total_clients', (SELECT count(*) FROM public.profiles),
    'active_clients', (SELECT count(*) FROM public.profiles WHERE client_status = 'active'),
    'inactive_clients', (SELECT count(*) FROM public.profiles WHERE client_status <> 'active'),
    'total_subscribers', (SELECT count(*) FROM public.marketing_subscribers),
    'active_subscribers', (SELECT count(*) FROM public.marketing_subscribers WHERE status = 'active'),
    'unsubscribed', (SELECT count(*) FROM public.marketing_subscribers WHERE status = 'unsubscribed'),
    'new_this_month', (SELECT count(*) FROM public.marketing_subscribers WHERE created_at >= date_trunc('month', now())),
    'campaigns', (SELECT count(*) FROM public.marketing_campaigns),
    'scheduled_campaigns', (SELECT count(*) FROM public.marketing_campaigns WHERE status = 'scheduled'),
    'sources', coalesce((SELECT jsonb_agg(s) FROM (
        SELECT source AS name, count(*)::int AS count
        FROM public.marketing_subscribers GROUP BY source ORDER BY count(*) DESC) s), '[]'::jsonb),
    'growth', coalesce((SELECT jsonb_agg(g ORDER BY g.day) FROM (
        SELECT (created_at AT TIME ZONE 'UTC')::date AS day, count(*)::int AS count
        FROM public.marketing_subscribers
        WHERE created_at > now() - interval '90 days'
        GROUP BY 1) g), '[]'::jsonb),
    'top_flyers', coalesce((SELECT jsonb_agg(f) FROM (
        SELECT coalesce(s.flyer_name, 'Unknown flyer') AS name, count(*)::int AS count
        FROM public.marketing_subscribers s
        WHERE s.flyer_id IS NOT NULL
        GROUP BY 1 ORDER BY count(*) DESC LIMIT 10) f), '[]'::jsonb),
    'top_clients', coalesce((SELECT jsonb_agg(c) FROM (
        SELECT coalesce(p.full_name, p.email, 'Client') AS name, count(*)::int AS count
        FROM public.marketing_subscribers s
        JOIN public.profiles p ON p.id = s.client_id
        GROUP BY 1 ORDER BY count(*) DESC LIMIT 10) c), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END $$;

-- ---------- client list for admin targeting ----------
CREATE OR REPLACE FUNCTION public.marketing_list_clients()
RETURNS TABLE(id uuid, email text, full_name text, client_status text, subscriber_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email, p.full_name, p.client_status,
         (SELECT count(*) FROM public.marketing_subscribers s WHERE s.client_id = p.id)
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'admin'::public.app_role)
  ORDER BY coalesce(p.full_name, p.email)
$$;

CREATE OR REPLACE FUNCTION public.marketing_set_client_status(_client_id uuid, _status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _status NOT IN ('active','inactive','suspended','archived') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid status');
  END IF;
  UPDATE public.profiles SET client_status = _status WHERE id = _client_id;
  RETURN jsonb_build_object('ok', true);
END $$;