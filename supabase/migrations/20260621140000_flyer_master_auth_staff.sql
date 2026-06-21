-- Allow owners, admins, and editors to manage master PIN (Live Orders unlock).
-- Admin portal access was already allowed in FlyerPortal.tsx but RLS blocked INSERT.

CREATE POLICY "staff manage master auth"
ON public.flyer_master_auth FOR ALL TO authenticated
USING (public.user_can_manage_flyer_portal(flyer_id))
WITH CHECK (public.user_can_manage_flyer_portal(flyer_id));

-- Allow staff to update menu order status from portal (admin could read but not update).
CREATE POLICY "staff update menu orders"
ON public.menu_orders FOR UPDATE TO authenticated
USING (public.user_can_manage_flyer_portal(flyer_id))
WITH CHECK (public.user_can_manage_flyer_portal(flyer_id));
