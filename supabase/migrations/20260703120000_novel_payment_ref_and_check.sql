ALTER TABLE public.novel_purchases
  ADD COLUMN IF NOT EXISTS payment_ref uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_novel_purchases_payment_ref
  ON public.novel_purchases(payment_ref)
  WHERE payment_ref IS NOT NULL;

CREATE OR REPLACE FUNCTION public.check_novel_payment(_payment_ref uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.novel_purchases;
BEGIN
  IF _payment_ref IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_ref');
  END IF;

  SELECT * INTO p FROM public.novel_purchases WHERE payment_ref = _payment_ref;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF p.status = 'completed' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'completed', true,
      'purchase_type', p.purchase_type,
      'chapter_numbers', to_jsonb(p.chapter_numbers),
      'amount', p.amount,
      'currency', p.currency
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'completed', false, 'status', p.status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_novel_payment(uuid) TO anon, authenticated;
