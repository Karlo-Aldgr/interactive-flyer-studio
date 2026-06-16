
-- novel_purchases
CREATE TABLE public.novel_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_id uuid NOT NULL REFERENCES public.flyers(id) ON DELETE CASCADE,
  action_id text NOT NULL,
  book_title text,
  buyer_email text NOT NULL,
  buyer_name text,
  purchase_type text NOT NULL CHECK (purchase_type IN ('bundle','chapter')),
  chapter_numbers integer[] NOT NULL DEFAULT '{}',
  amount numeric(10,2),
  currency text DEFAULT 'USD',
  paypal_txn_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_novel_purchases_flyer ON public.novel_purchases(flyer_id);
CREATE INDEX idx_novel_purchases_email ON public.novel_purchases(lower(buyer_email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.novel_purchases TO authenticated;
GRANT INSERT, SELECT ON public.novel_purchases TO anon;
GRANT ALL ON public.novel_purchases TO service_role;

ALTER TABLE public.novel_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create a purchase"
  ON public.novel_purchases FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Buyer or owner can read purchase by id"
  ON public.novel_purchases FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Owner can update purchase"
  ON public.novel_purchases FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Owner can delete purchase"
  ON public.novel_purchases FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER set_novel_purchases_updated_at
  BEFORE UPDATE ON public.novel_purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- novel_subscriptions
CREATE TABLE public.novel_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_id uuid NOT NULL REFERENCES public.flyers(id) ON DELETE CASCADE,
  action_id text NOT NULL,
  book_title text,
  subscriber_email text NOT NULL,
  subscriber_name text,
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free','paid')),
  paypal_subscription_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','expired')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flyer_id, action_id, subscriber_email, tier)
);
CREATE INDEX idx_novel_subs_flyer ON public.novel_subscriptions(flyer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.novel_subscriptions TO authenticated;
GRANT INSERT ON public.novel_subscriptions TO anon;
GRANT ALL ON public.novel_subscriptions TO service_role;

ALTER TABLE public.novel_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe"
  ON public.novel_subscriptions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Owner can read subscriptions"
  ON public.novel_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Owner can update subscriptions"
  ON public.novel_subscriptions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Owner can delete subscriptions"
  ON public.novel_subscriptions FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER set_novel_subscriptions_updated_at
  BEFORE UPDATE ON public.novel_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
