-- Scheduled Facebook auto-post: invoke meta-post-scheduled every minute via pg_net.
-- Set the cron secret with:
--   insert into public.meta_cron_config (cron_secret) values ('YOUR_META_CRON_SECRET')
--   on conflict (id) do update set cron_secret = excluded.cron_secret, updated_at = now();

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.meta_cron_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cron_secret text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_cron_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meta_cron_config_no_client_access" ON public.meta_cron_config;
CREATE POLICY "meta_cron_config_no_client_access"
  ON public.meta_cron_config
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.invoke_meta_facebook_scheduled()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id bigint;
  secret text;
  fn_url text := 'https://iwmykqilqywbzxpcgaop.supabase.co/functions/v1/meta-post-scheduled';
BEGIN
  SELECT cron_secret INTO secret FROM public.meta_cron_config WHERE id = 1;
  IF secret IS NULL OR length(trim(secret)) = 0 THEN
    RAISE WARNING 'meta_cron_config.cron_secret is not set — skip meta-post-scheduled invoke';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-meta-cron-secret', secret
    ),
    body := '{}'::jsonb
  ) INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_meta_facebook_scheduled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invoke_meta_facebook_scheduled() TO postgres;

DO $$
BEGIN
  PERFORM cron.unschedule('meta-facebook-scheduled-autopost');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'meta-facebook-scheduled-autopost',
  '* * * * *',
  $$SELECT public.invoke_meta_facebook_scheduled();$$
);
