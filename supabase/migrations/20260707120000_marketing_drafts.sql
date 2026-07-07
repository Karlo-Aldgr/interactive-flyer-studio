-- Phase 1: AI marketing drafts (Facebook + Instagram) from published flyers.

CREATE TABLE public.marketing_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_id uuid NOT NULL REFERENCES public.flyers(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  flyer_title text,
  flyer_url text,
  thumbnail_url text,
  facebook_post text,
  instagram_caption text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_drafts_flyer ON public.marketing_drafts(flyer_id);
CREATE INDEX idx_marketing_drafts_owner ON public.marketing_drafts(owner_id);
CREATE INDEX idx_marketing_drafts_created ON public.marketing_drafts(created_at DESC);

ALTER TABLE public.marketing_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read own marketing drafts"
  ON public.marketing_drafts FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Owners can insert own marketing drafts"
  ON public.marketing_drafts FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

GRANT SELECT, INSERT ON public.marketing_drafts TO authenticated;
GRANT ALL ON public.marketing_drafts TO service_role;

CREATE TRIGGER set_marketing_drafts_updated_at
  BEFORE UPDATE ON public.marketing_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
