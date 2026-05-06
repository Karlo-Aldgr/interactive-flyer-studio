-- Drop the unused polls config table — config will live in actions.payload
DROP TABLE IF EXISTS public.polls CASCADE;

-- Recreate poll_votes keyed by action_id
DROP TABLE IF EXISTS public.poll_votes CASCADE;

CREATE TABLE public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL,
  flyer_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (action_id, session_id, option_id)
);

CREATE INDEX poll_votes_action_id_idx ON public.poll_votes(action_id);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads votes of published flyers"
  ON public.poll_votes FOR SELECT
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = poll_votes.flyer_id AND f.status = 'published'));

CREATE POLICY "anyone votes on published flyers"
  ON public.poll_votes FOR INSERT
  TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = poll_votes.flyer_id AND f.status = 'published'));

CREATE POLICY "owner reads all votes"
  ON public.poll_votes FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = poll_votes.flyer_id AND f.owner_id = auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
ALTER TABLE public.poll_votes REPLICA IDENTITY FULL;