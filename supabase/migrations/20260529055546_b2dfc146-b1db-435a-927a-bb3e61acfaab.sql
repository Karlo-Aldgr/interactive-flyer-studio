CREATE TABLE public.menu_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_id uuid NOT NULL,
  action_id uuid,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal_cents int NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'new',
  payment_status text NOT NULL DEFAULT 'unpaid',
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_orders TO authenticated;
GRANT INSERT ON public.menu_orders TO anon;
GRANT ALL ON public.menu_orders TO service_role;

ALTER TABLE public.menu_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone places order on published"
ON public.menu_orders FOR INSERT TO anon, authenticated
WITH CHECK (EXISTS (SELECT 1 FROM flyers f WHERE f.id = menu_orders.flyer_id AND f.status = 'published'));

CREATE POLICY "owner reads orders"
ON public.menu_orders FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM flyers f WHERE f.id = menu_orders.flyer_id AND f.owner_id = auth.uid()));

CREATE POLICY "owner updates orders"
ON public.menu_orders FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM flyers f WHERE f.id = menu_orders.flyer_id AND f.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM flyers f WHERE f.id = menu_orders.flyer_id AND f.owner_id = auth.uid()));

CREATE POLICY "owner deletes orders"
ON public.menu_orders FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM flyers f WHERE f.id = menu_orders.flyer_id AND f.owner_id = auth.uid()));

CREATE POLICY "admins read all orders"
ON public.menu_orders FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER menu_orders_set_updated_at
BEFORE UPDATE ON public.menu_orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_menu_orders_flyer ON public.menu_orders(flyer_id, created_at DESC);