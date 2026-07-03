-- Allow novel checkout on draft flyers (editor preview) as well as published live flyers.
DROP POLICY IF EXISTS "Anyone can create a purchase" ON public.novel_purchases;

CREATE POLICY "Anyone can create a purchase"
  ON public.novel_purchases FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flyers f
      WHERE f.id = novel_purchases.flyer_id
    )
  );
