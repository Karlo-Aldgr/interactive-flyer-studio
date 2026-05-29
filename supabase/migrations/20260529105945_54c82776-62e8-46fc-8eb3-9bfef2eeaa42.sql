-- ============== 1. menu_orders: add table_number, order_type, archived_at, pickup_at, approved_by ==============
ALTER TABLE public.menu_orders
  ADD COLUMN IF NOT EXISTS table_number text,
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'dine_in',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS waiter_id uuid;

CREATE INDEX IF NOT EXISTS idx_menu_orders_flyer_archived ON public.menu_orders(flyer_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_menu_orders_table ON public.menu_orders(flyer_id, table_number) WHERE archived_at IS NULL;

-- ============== 2. waiters ==============
CREATE TABLE IF NOT EXISTS public.waiters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_id uuid NOT NULL,
  name text NOT NULL,
  pin_hash text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.waiters TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waiters TO authenticated;
GRANT ALL ON public.waiters TO service_role;

ALTER TABLE public.waiters ENABLE ROW LEVEL SECURITY;

-- Anon can read only name/color/active (we'll handle column filtering via a view; for now allow basic select for greeting)
CREATE POLICY "anyone reads active waiters of published"
  ON public.waiters FOR SELECT TO anon, authenticated
  USING (active = true AND EXISTS (SELECT 1 FROM flyers f WHERE f.id = waiters.flyer_id AND f.status = 'published'));

CREATE POLICY "owner full access waiters"
  ON public.waiters FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM flyers f WHERE f.id = waiters.flyer_id AND f.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM flyers f WHERE f.id = waiters.flyer_id AND f.owner_id = auth.uid()));

CREATE TRIGGER waiters_updated BEFORE UPDATE ON public.waiters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== 3. table_assignments ==============
CREATE TABLE IF NOT EXISTS public.table_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_id uuid NOT NULL,
  table_number text NOT NULL,
  waiter_id uuid REFERENCES public.waiters(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flyer_id, table_number)
);

GRANT SELECT ON public.table_assignments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.table_assignments TO authenticated;
GRANT ALL ON public.table_assignments TO service_role;

ALTER TABLE public.table_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads assignments of published"
  ON public.table_assignments FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM flyers f WHERE f.id = table_assignments.flyer_id AND f.status = 'published'));

CREATE POLICY "owner full access assignments"
  ON public.table_assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM flyers f WHERE f.id = table_assignments.flyer_id AND f.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM flyers f WHERE f.id = table_assignments.flyer_id AND f.owner_id = auth.uid()));

CREATE TRIGGER table_assignments_updated BEFORE UPDATE ON public.table_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== 4. flyer_master_auth (master PIN per flyer) ==============
CREATE TABLE IF NOT EXISTS public.flyer_master_auth (
  flyer_id uuid PRIMARY KEY,
  master_pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flyer_master_auth TO authenticated;
GRANT ALL ON public.flyer_master_auth TO service_role;

ALTER TABLE public.flyer_master_auth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages master auth"
  ON public.flyer_master_auth FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM flyers f WHERE f.id = flyer_master_auth.flyer_id AND f.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM flyers f WHERE f.id = flyer_master_auth.flyer_id AND f.owner_id = auth.uid()));

CREATE TRIGGER fma_updated BEFORE UPDATE ON public.flyer_master_auth
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== 5. Realtime ==============
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.waiters;

-- ============== 6. Daily 3 AM archive (pg_cron) ==============
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.archive_menu_orders_daily()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.menu_orders
     SET archived_at = now()
   WHERE archived_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Remove previous schedule if re-run, then schedule fresh
DO $$
BEGIN
  PERFORM cron.unschedule('archive-menu-orders-3am');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'archive-menu-orders-3am',
  '0 3 * * *',
  $$SELECT public.archive_menu_orders_daily();$$
);
