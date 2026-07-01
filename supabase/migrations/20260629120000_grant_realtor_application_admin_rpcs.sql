-- Allow authenticated admins to call realtor application admin RPCs from the client.
GRANT EXECUTE ON FUNCTION public.admin_list_realtor_applications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_realtor_application(uuid, text, text) TO authenticated;
