-- Hide pin_hash: drop anon access to waiters, expose safe public view
DROP POLICY IF EXISTS "anyone reads active waiters of published" ON public.waiters;
REVOKE SELECT ON public.waiters FROM anon;

CREATE OR REPLACE VIEW public.waiters_public
WITH (security_invoker = on) AS
SELECT w.id, w.flyer_id, w.name, w.color, w.active
FROM public.waiters w
WHERE w.active = true
  AND EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = w.flyer_id AND f.status = 'published');

GRANT SELECT ON public.waiters_public TO anon, authenticated;

-- Re-add an authenticated-only read policy on waiters for owner portals (owner full access already covers owners)
-- (no additional policy needed; owners use the existing "owner full access waiters")

-- Lock down SECURITY DEFINER funcs so only postgres / cron can run them
REVOKE EXECUTE ON FUNCTION public.archive_menu_orders_daily() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unpublish_expired_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
