
CREATE TABLE public.listing_pending_details (
  flyer_id uuid PRIMARY KEY REFERENCES public.flyers(id) ON DELETE CASCADE,
  seller_name text,
  buyer_name text,
  buyer_agent_name text,
  buyer_agent_brokerage text,
  agreed_price_cents bigint,
  earnest_money_cents bigint,
  closing_costs_cents bigint,
  contract_date date,
  inspection_deadline date,
  financing_deadline date,
  closing_date date,
  title_company text,
  lender text,
  contingencies text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_pending_details TO authenticated;
GRANT ALL ON public.listing_pending_details TO service_role;

ALTER TABLE public.listing_pending_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or admin can view pending details"
  ON public.listing_pending_details FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Owner or admin can insert pending details"
  ON public.listing_pending_details FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Owner or admin can update pending details"
  ON public.listing_pending_details FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Owner or admin can delete pending details"
  ON public.listing_pending_details FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = flyer_id AND f.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE TRIGGER listing_pending_details_set_updated_at
  BEFORE UPDATE ON public.listing_pending_details
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.get_listing_pending_details(_flyer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flyer record;
  v_details public.listing_pending_details;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT id, owner_id, address, title, price_cents, listing_status, beds, baths, sqft
    INTO v_flyer FROM public.flyers WHERE id = _flyer_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Listing not found');
  END IF;

  IF NOT (v_flyer.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_details FROM public.listing_pending_details WHERE flyer_id = _flyer_id;

  RETURN jsonb_build_object(
    'ok', true,
    'listing', to_jsonb(v_flyer),
    'details', CASE WHEN v_details.flyer_id IS NULL THEN NULL ELSE to_jsonb(v_details) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_listing_pending_details(_flyer_id uuid, _payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT owner_id INTO v_owner FROM public.flyers WHERE id = _flyer_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Listing not found');
  END IF;
  IF NOT (v_owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.listing_pending_details AS d (
    flyer_id, seller_name, buyer_name, buyer_agent_name, buyer_agent_brokerage,
    agreed_price_cents, earnest_money_cents, closing_costs_cents,
    contract_date, inspection_deadline, financing_deadline, closing_date,
    title_company, lender, contingencies, notes
  ) VALUES (
    _flyer_id,
    NULLIF(_payload->>'seller_name',''),
    NULLIF(_payload->>'buyer_name',''),
    NULLIF(_payload->>'buyer_agent_name',''),
    NULLIF(_payload->>'buyer_agent_brokerage',''),
    NULLIF(_payload->>'agreed_price_cents','')::bigint,
    NULLIF(_payload->>'earnest_money_cents','')::bigint,
    NULLIF(_payload->>'closing_costs_cents','')::bigint,
    NULLIF(_payload->>'contract_date','')::date,
    NULLIF(_payload->>'inspection_deadline','')::date,
    NULLIF(_payload->>'financing_deadline','')::date,
    NULLIF(_payload->>'closing_date','')::date,
    NULLIF(_payload->>'title_company',''),
    NULLIF(_payload->>'lender',''),
    NULLIF(_payload->>'contingencies',''),
    NULLIF(_payload->>'notes','')
  )
  ON CONFLICT (flyer_id) DO UPDATE SET
    seller_name = EXCLUDED.seller_name,
    buyer_name = EXCLUDED.buyer_name,
    buyer_agent_name = EXCLUDED.buyer_agent_name,
    buyer_agent_brokerage = EXCLUDED.buyer_agent_brokerage,
    agreed_price_cents = EXCLUDED.agreed_price_cents,
    earnest_money_cents = EXCLUDED.earnest_money_cents,
    closing_costs_cents = EXCLUDED.closing_costs_cents,
    contract_date = EXCLUDED.contract_date,
    inspection_deadline = EXCLUDED.inspection_deadline,
    financing_deadline = EXCLUDED.financing_deadline,
    closing_date = EXCLUDED.closing_date,
    title_company = EXCLUDED.title_company,
    lender = EXCLUDED.lender,
    contingencies = EXCLUDED.contingencies,
    notes = EXCLUDED.notes,
    updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;
