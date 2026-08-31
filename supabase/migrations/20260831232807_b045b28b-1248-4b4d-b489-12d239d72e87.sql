REVOKE EXECUTE ON FUNCTION public.admin_zernio_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_zernio_overview() TO authenticated;