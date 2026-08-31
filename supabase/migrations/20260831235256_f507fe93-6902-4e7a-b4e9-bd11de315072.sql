CREATE OR REPLACE FUNCTION public.client_plan_limits(_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.plans;
  target uuid;
  period date := date_trunc('month', now())::date;
  used_posts int;
  used_scheduled int;
  connected int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  target := COALESCE(_user_id, auth.uid());
  IF target <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT pl.* INTO p
  FROM public.client_subscriptions s
  JOIN public.plans pl ON pl.id = s.plan_id
  WHERE s.user_id = target AND s.status = 'active';

  IF p.id IS NULL THEN
    SELECT * INTO p FROM public.plans WHERE is_default AND active ORDER BY display_order LIMIT 1;
  END IF;
  IF p.id IS NULL THEN
    SELECT * INTO p FROM public.plans WHERE active ORDER BY display_order LIMIT 1;
  END IF;

  SELECT count(*) INTO used_posts FROM public.zernio_posts
   WHERE user_id = target AND created_at >= period AND status <> 'draft';
  SELECT count(*) INTO used_scheduled FROM public.zernio_posts
   WHERE user_id = target AND status = 'scheduled';
  SELECT count(*) INTO connected FROM public.zernio_accounts
   WHERE user_id = target AND status = 'connected';

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

REVOKE ALL ON FUNCTION public.client_plan_limits(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_plan_limits(uuid) TO authenticated, service_role;