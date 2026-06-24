GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.flyer_mini_ad_enabled(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.pick_mini_ad() TO authenticated, anon, service_role;