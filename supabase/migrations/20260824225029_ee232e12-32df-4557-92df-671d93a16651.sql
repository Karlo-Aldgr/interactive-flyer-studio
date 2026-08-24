DROP POLICY IF EXISTS "anyone can submit to published websites" ON public.form_submissions;
CREATE POLICY "anyone can submit to published websites" ON public.form_submissions FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = form_submissions.flyer_id AND f.website_status = 'published'));