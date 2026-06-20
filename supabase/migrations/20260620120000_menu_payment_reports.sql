-- Payment tracking, daily summaries, and age-based archiving for menu orders.

ALTER TABLE public.menu_orders
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'pay_later',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_menu_orders_payment ON public.menu_orders(flyer_id, payment_status)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.menu_daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_id uuid NOT NULL REFERENCES public.flyers(id) ON DELETE CASCADE,
  summary_date date NOT NULL,
  total_orders int NOT NULL DEFAULT 0,
  completed_orders int NOT NULL DEFAULT 0,
  pending_orders int NOT NULL DEFAULT 0,
  cancelled_orders int NOT NULL DEFAULT 0,
  total_sales_cents int NOT NULL DEFAULT 0,
  paid_orders int NOT NULL DEFAULT 0,
  unpaid_orders int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flyer_id, summary_date)
);

ALTER TABLE public.menu_daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads daily summaries"
  ON public.menu_daily_summaries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = menu_daily_summaries.flyer_id AND f.owner_id = auth.uid()));

CREATE POLICY "owner manages daily summaries"
  ON public.menu_daily_summaries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = menu_daily_summaries.flyer_id AND f.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = menu_daily_summaries.flyer_id AND f.owner_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_daily_summaries TO authenticated;
GRANT ALL ON public.menu_daily_summaries TO service_role;

CREATE TRIGGER menu_daily_summaries_updated
  BEFORE UPDATE ON public.menu_daily_summaries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Upsert a daily summary for one flyer + date from all orders on that calendar day.
CREATE OR REPLACE FUNCTION public.upsert_menu_daily_summary(p_flyer_id uuid, p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_completed int;
  v_pending int;
  v_cancelled int;
  v_sales int;
  v_paid int;
  v_unpaid int;
BEGIN
  SELECT
    count(*)::int,
    count(*) FILTER (WHERE status IN ('completed', 'served'))::int,
    count(*) FILTER (WHERE status IN ('new', 'pending_approval', 'preparing', 'on_hold'))::int,
    count(*) FILTER (WHERE status IN ('cancelled', 'rejected'))::int,
    coalesce(sum(subtotal_cents) FILTER (WHERE status NOT IN ('cancelled', 'rejected', 'pending_approval')), 0)::int,
    count(*) FILTER (WHERE payment_status = 'paid')::int,
    count(*) FILTER (WHERE payment_status <> 'paid')::int
  INTO v_total, v_completed, v_pending, v_cancelled, v_sales, v_paid, v_unpaid
  FROM public.menu_orders
  WHERE flyer_id = p_flyer_id
    AND (created_at AT TIME ZONE 'UTC')::date = p_date;

  IF v_total = 0 THEN RETURN; END IF;

  INSERT INTO public.menu_daily_summaries (
    flyer_id, summary_date, total_orders, completed_orders, pending_orders,
    cancelled_orders, total_sales_cents, paid_orders, unpaid_orders
  ) VALUES (
    p_flyer_id, p_date, v_total, v_completed, v_pending,
    v_cancelled, v_sales, v_paid, v_unpaid
  )
  ON CONFLICT (flyer_id, summary_date) DO UPDATE SET
    total_orders = EXCLUDED.total_orders,
    completed_orders = EXCLUDED.completed_orders,
    pending_orders = EXCLUDED.pending_orders,
    cancelled_orders = EXCLUDED.cancelled_orders,
    total_sales_cents = EXCLUDED.total_sales_cents,
    paid_orders = EXCLUDED.paid_orders,
    unpaid_orders = EXCLUDED.unpaid_orders,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_menu_daily_summary(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_menu_daily_summary(uuid, date) TO authenticated, service_role;

-- Archive orders older than 5 days; snapshot summaries first.
CREATE OR REPLACE FUNCTION public.archive_menu_orders_daily()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
  rec record;
  cutoff timestamptz := now() - interval '5 days';
BEGIN
  FOR rec IN
    SELECT DISTINCT flyer_id, (created_at AT TIME ZONE 'UTC')::date AS d
    FROM public.menu_orders
    WHERE archived_at IS NULL AND created_at < cutoff
  LOOP
    PERFORM public.upsert_menu_daily_summary(rec.flyer_id, rec.d);
  END LOOP;

  UPDATE public.menu_orders
     SET archived_at = now()
   WHERE archived_at IS NULL
     AND created_at < cutoff;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
