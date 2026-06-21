-- Public menu checkout: anon/authenticated can INSERT but had no SELECT policy,
-- so insert().select("id") failed with RLS. Use SECURITY DEFINER RPC instead.

CREATE OR REPLACE FUNCTION public.place_menu_order(
  _flyer_id uuid,
  _action_id uuid,
  _customer_name text,
  _customer_phone text,
  _items jsonb,
  _subtotal_cents int,
  _notes text,
  _table_number text,
  _order_type text,
  _pickup_at timestamptz,
  _status text,
  _payment_method text DEFAULT 'pay_later',
  _payment_status text DEFAULT 'unpaid',
  _paid_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.flyers f
    WHERE f.id = _flyer_id AND f.status = 'published'::flyer_status
  ) THEN
    RAISE EXCEPTION 'flyer not published';
  END IF;

  INSERT INTO public.menu_orders (
    flyer_id,
    action_id,
    customer_name,
    customer_phone,
    items,
    subtotal_cents,
    notes,
    table_number,
    order_type,
    pickup_at,
    status,
    payment_method,
    payment_status,
    paid_at
  ) VALUES (
    _flyer_id,
    _action_id,
    _customer_name,
    _customer_phone,
    COALESCE(_items, '[]'::jsonb),
    COALESCE(_subtotal_cents, 0),
    _notes,
    _table_number,
    _order_type,
    _pickup_at,
    COALESCE(_status, 'new'),
    COALESCE(_payment_method, 'pay_later'),
    COALESCE(_payment_status, 'unpaid'),
    _paid_at
  )
  RETURNING id INTO _order_id;

  RETURN _order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.place_menu_order(
  uuid, uuid, text, text, jsonb, int, text, text, text, timestamptz, text, text, text, timestamptz
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_menu_order(
  uuid, uuid, text, text, jsonb, int, text, text, text, timestamptz, text, text, text, timestamptz
) TO anon, authenticated;
