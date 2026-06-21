
-- 1) Tighten always-true INSERT policies on novel tables
DROP POLICY IF EXISTS "Anyone can create a purchase" ON public.novel_purchases;
CREATE POLICY "Anyone can create a purchase"
  ON public.novel_purchases FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flyers f
      WHERE f.id = novel_purchases.flyer_id
        AND f.status = 'published'::public.flyer_status
    )
  );

DROP POLICY IF EXISTS "Anyone can subscribe" ON public.novel_subscriptions;
CREATE POLICY "Anyone can subscribe"
  ON public.novel_subscriptions FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flyers f
      WHERE f.id = novel_subscriptions.flyer_id
        AND f.status = 'published'::public.flyer_status
    )
  );

-- 2) Remove table_assignments from realtime publication (app does on-demand reads only)
ALTER PUBLICATION supabase_realtime DROP TABLE public.table_assignments;
