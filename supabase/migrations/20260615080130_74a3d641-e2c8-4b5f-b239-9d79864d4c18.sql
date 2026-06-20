
-- Admin-only RPCs: remove EXECUTE from public/anon/authenticated (admin-only)
REVOKE EXECUTE ON FUNCTION public.grant_editor_by_email(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_editor_by_email(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.list_editors() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unpublish_expired_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.archive_menu_orders_daily() FROM PUBLIC, anon, authenticated;

-- Trigger-only functions: not meant to be called via API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_flyer_portal_credentials() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flyers_sync_auto_unpublish() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- has_role / current_user_can_edit are used inside RLS policies; restrict anon but keep authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_can_edit() FROM PUBLIC, anon;
