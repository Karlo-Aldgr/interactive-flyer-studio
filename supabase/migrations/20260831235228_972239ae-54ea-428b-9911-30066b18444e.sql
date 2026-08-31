-- ============================ zernio_posts ============================
CREATE TABLE public.zernio_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid REFERENCES public.zernio_profiles(id) ON DELETE SET NULL,
  zernio_profile_id text,
  zernio_post_id text,
  title text,
  content text NOT NULL DEFAULT '',
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  account_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  zernio_account_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  platforms jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  timezone text NOT NULL DEFAULT 'UTC',
  published_at timestamptz,
  last_error text,
  provider text NOT NULL DEFAULT 'zernio',
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX zernio_posts_user_idx ON public.zernio_posts(user_id, created_at DESC);
CREATE INDEX zernio_posts_remote_idx ON public.zernio_posts(zernio_post_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zernio_posts TO authenticated;
GRANT ALL ON public.zernio_posts TO service_role;
ALTER TABLE public.zernio_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own zernio posts"
  ON public.zernio_posts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all zernio posts"
  ON public.zernio_posts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER zernio_posts_set_updated_at
  BEFORE UPDATE ON public.zernio_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================================ plans ================================
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  billing_period text NOT NULL DEFAULT 'monthly',
  max_social_accounts integer NOT NULL DEFAULT 2,
  max_posts_per_month integer NOT NULL DEFAULT 30,
  max_scheduled_posts integer NOT NULL DEFAULT 10,
  max_team_members integer NOT NULL DEFAULT 1,
  analytics_access boolean NOT NULL DEFAULT false,
  ai_features boolean NOT NULL DEFAULT false,
  priority_support boolean NOT NULL DEFAULT false,
  promo_text text,
  display_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon;
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active plans" ON public.plans FOR SELECT USING (active = true);
CREATE POLICY "Admins manage plans" ON public.plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER plans_set_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  feature_label text NOT NULL,
  feature_value text,
  included boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX plan_features_unique ON public.plan_features(plan_id, feature_key);
GRANT SELECT ON public.plan_features TO anon;
GRANT SELECT ON public.plan_features TO authenticated;
GRANT ALL ON public.plan_features TO service_role;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view features of active plans" ON public.plan_features FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.plans p WHERE p.id = plan_id AND p.active));
CREATE POLICY "Admins manage plan features" ON public.plan_features FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER plan_features_set_updated_at BEFORE UPDATE ON public.plan_features
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========================= client_subscriptions =========================
CREATE TABLE public.client_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  current_period_end timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  cancel_at timestamptz,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.client_subscriptions TO authenticated;
GRANT ALL ON public.client_subscriptions TO service_role;
ALTER TABLE public.client_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own subscription" ON public.client_subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage subscriptions" ON public.client_subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER client_subscriptions_set_updated_at BEFORE UPDATE ON public.client_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================= client_usage =============================
CREATE TABLE public.client_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_start date NOT NULL DEFAULT date_trunc('month', now())::date,
  posts_created integer NOT NULL DEFAULT 0,
  scheduled_posts integer NOT NULL DEFAULT 0,
  accounts_connected integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX client_usage_unique ON public.client_usage(user_id, period_start);
GRANT SELECT ON public.client_usage TO authenticated;
GRANT ALL ON public.client_usage TO service_role;
ALTER TABLE public.client_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own usage" ON public.client_usage FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all usage" ON public.client_usage FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER client_usage_set_updated_at BEFORE UPDATE ON public.client_usage
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================= usage_events =============================
CREATE TABLE public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_events_user_idx ON public.usage_events(user_id, created_at DESC);
GRANT SELECT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own usage events" ON public.usage_events FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all usage events" ON public.usage_events FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================== seed plans ==============================
INSERT INTO public.plans
  (slug, name, description, price_cents, billing_period, max_social_accounts,
   max_posts_per_month, max_scheduled_posts, max_team_members,
   analytics_access, ai_features, priority_support, display_order, is_default, active)
VALUES
  ('starter', 'Starter', 'Get going with a couple of social accounts.', 0, 'monthly', 2, 20, 10, 1, false, false, false, 1, true, true),
  ('growth', 'Growth', 'For businesses posting regularly across channels.', 2900, 'monthly', 6, 150, 60, 3, true, true, false, 2, false, true),
  ('pro', 'Pro', 'Full reach, analytics and priority support.', 7900, 'monthly', 20, 1000, 400, 10, true, true, true, 3, false, true);

-- ===================== server-side limit helper =========================
CREATE OR REPLACE FUNCTION public.client_plan_limits(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.plans;
  period date := date_trunc('month', now())::date;
  used_posts int;
  used_scheduled int;
  connected int;
BEGIN
  SELECT pl.* INTO p
  FROM public.client_subscriptions s
  JOIN public.plans pl ON pl.id = s.plan_id
  WHERE s.user_id = _user_id AND s.status = 'active';

  IF p.id IS NULL THEN
    SELECT * INTO p FROM public.plans WHERE is_default AND active ORDER BY display_order LIMIT 1;
  END IF;
  IF p.id IS NULL THEN
    SELECT * INTO p FROM public.plans WHERE active ORDER BY display_order LIMIT 1;
  END IF;

  SELECT count(*) INTO used_posts FROM public.zernio_posts
   WHERE user_id = _user_id AND created_at >= period AND status <> 'draft';
  SELECT count(*) INTO used_scheduled FROM public.zernio_posts
   WHERE user_id = _user_id AND status = 'scheduled';
  SELECT count(*) INTO connected FROM public.zernio_accounts
   WHERE user_id = _user_id AND status = 'connected';

  RETURN jsonb_build_object(
    'plan', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', p.id, 'slug', p.slug, 'name', p.name, 'price_cents', p.price_cents,
      'currency', p.currency, 'billing_period', p.billing_period,
      'max_social_accounts', p.max_social_accounts,
      'max_posts_per_month', p.max_posts_per_month,
      'max_scheduled_posts', p.max_scheduled_posts,
      'max_team_members', p.max_team_members,
      'analytics_access', p.analytics_access, 'ai_features', p.ai_features,
      'priority_support', p.priority_support) END,
    'usage', jsonb_build_object(
      'posts_this_month', used_posts,
      'scheduled_posts', used_scheduled,
      'connected_accounts', connected)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.client_plan_limits(uuid) TO authenticated, service_role;