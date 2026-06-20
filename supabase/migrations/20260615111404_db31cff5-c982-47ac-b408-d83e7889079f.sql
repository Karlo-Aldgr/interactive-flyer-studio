GRANT EXECUTE ON FUNCTION public.list_editors() TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_editor_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_editor_by_email(text) TO authenticated;