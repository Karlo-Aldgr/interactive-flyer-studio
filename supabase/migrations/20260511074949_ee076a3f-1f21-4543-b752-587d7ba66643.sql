ALTER TABLE public.form_submissions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';

CREATE POLICY "owner updates submissions"
ON public.form_submissions
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = form_submissions.flyer_id AND f.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = form_submissions.flyer_id AND f.owner_id = auth.uid()));