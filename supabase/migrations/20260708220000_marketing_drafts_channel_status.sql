-- Phase 2: per-channel status + scheduling for Facebook / Instagram drafts.
-- App-only scheduling (no Meta posting yet).

ALTER TABLE public.marketing_drafts
  ADD COLUMN IF NOT EXISTS facebook_status text NOT NULL DEFAULT 'draft'
    CHECK (facebook_status IN ('draft', 'scheduled', 'posted', 'failed')),
  ADD COLUMN IF NOT EXISTS instagram_status text NOT NULL DEFAULT 'draft'
    CHECK (instagram_status IN ('draft', 'scheduled', 'posted', 'failed')),
  ADD COLUMN IF NOT EXISTS facebook_scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS instagram_scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS facebook_posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS instagram_posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS facebook_error_message text,
  ADD COLUMN IF NOT EXISTS instagram_error_message text;

CREATE INDEX IF NOT EXISTS idx_marketing_drafts_fb_scheduled
  ON public.marketing_drafts(facebook_scheduled_for)
  WHERE facebook_status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_marketing_drafts_ig_scheduled
  ON public.marketing_drafts(instagram_scheduled_for)
  WHERE instagram_status = 'scheduled';

-- Allow owners / admins / staff editors to update schedule + status fields.
DROP POLICY IF EXISTS "Flyer editors can update marketing drafts" ON public.marketing_drafts;

CREATE POLICY "Flyer editors can update marketing drafts"
  ON public.marketing_drafts FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.current_user_can_edit()
  )
  WITH CHECK (
    owner_id = (SELECT f.owner_id FROM public.flyers f WHERE f.id = flyer_id)
    AND (
      owner_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.current_user_can_edit()
    )
  );

GRANT UPDATE ON public.marketing_drafts TO authenticated;
