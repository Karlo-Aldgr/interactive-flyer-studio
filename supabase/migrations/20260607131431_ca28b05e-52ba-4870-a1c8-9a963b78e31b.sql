GRANT SELECT ON public.example_flyers TO anon;
GRANT SELECT ON public.example_flyers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.example_flyers TO authenticated;
GRANT ALL ON public.example_flyers TO service_role;