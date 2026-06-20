-- Waiter portal RPC for dev (no edge function required for /w/:token login).

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.waiter_pin_hash(p_flyer_id uuid, p_pin text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT encode(extensions.digest(p_flyer_id::text || '::' || p_pin || '::tap-that-flyer', 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.waiter_portal_rpc(
  p_flyer_id uuid,
  p_pin text,
  p_action text,
  p_order_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_waiter record;
  v_tables text[];
BEGIN
  IF p_flyer_id IS NULL OR p_pin IS NULL OR length(p_pin) < 4 THEN
    RETURN jsonb_build_object('error', 'missing flyer_id/pin');
  END IF;

  v_hash := public.waiter_pin_hash(p_flyer_id, p_pin);

  SELECT id, name, color, active INTO v_waiter
  FROM public.waiters
  WHERE flyer_id = p_flyer_id AND pin_hash = v_hash
  LIMIT 1;

  IF v_waiter IS NULL OR NOT v_waiter.active THEN
    RETURN jsonb_build_object('error', 'invalid pin');
  END IF;

  SELECT coalesce(array_agg(table_number ORDER BY table_number), ARRAY[]::text[])
  INTO v_tables
  FROM public.table_assignments
  WHERE flyer_id = p_flyer_id AND waiter_id = v_waiter.id;

  IF p_action = 'list' THEN
    RETURN jsonb_build_object(
      'waiter', jsonb_build_object('id', v_waiter.id, 'name', v_waiter.name, 'color', v_waiter.color),
      'tables', to_jsonb(v_tables),
      'orders', COALESCE((
        SELECT jsonb_agg(row_to_json(mo.*) ORDER BY mo.created_at DESC)
        FROM public.menu_orders mo
        WHERE mo.flyer_id = p_flyer_id
          AND mo.archived_at IS NULL
          AND mo.table_number = ANY(v_tables)
      ), '[]'::jsonb)
    );
  END IF;

  IF p_action = 'update_status' THEN
    IF p_order_id IS NULL OR p_status IS NULL THEN
      RETURN jsonb_build_object('error', 'missing order_id/status');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.menu_orders mo
      WHERE mo.id = p_order_id
        AND mo.flyer_id = p_flyer_id
        AND mo.table_number = ANY(v_tables)
    ) THEN
      RETURN jsonb_build_object('error', 'not your table');
    END IF;
    UPDATE public.menu_orders SET status = p_status WHERE id = p_order_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  RETURN jsonb_build_object('error', 'unknown action');
END;
$$;

REVOKE ALL ON FUNCTION public.waiter_portal_rpc(uuid, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.waiter_portal_rpc(uuid, text, text, uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.waiter_portal_resolve_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flyer_id uuid;
  v_title text;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN jsonb_build_object('error', 'missing token');
  END IF;

  SELECT c.flyer_id, f.title INTO v_flyer_id, v_title
  FROM public.flyer_portal_credentials c
  JOIN public.flyers f ON f.id = c.flyer_id
  WHERE c.portal_token::text = trim(p_token)
  LIMIT 1;

  IF v_flyer_id IS NULL THEN
    RETURN jsonb_build_object('error', 'invalid token');
  END IF;

  RETURN jsonb_build_object('flyer_id', v_flyer_id, 'title', coalesce(v_title, 'Flyer'));
END;
$$;

REVOKE ALL ON FUNCTION public.waiter_portal_resolve_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.waiter_portal_resolve_token(text) TO anon, authenticated;
