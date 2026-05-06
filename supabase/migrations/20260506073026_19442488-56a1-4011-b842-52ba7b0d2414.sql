-- Extend action_type enum
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'air_messages';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'poll';

-- Polls table (one row per action)
CREATE TABLE IF NOT EXISTS public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL UNIQUE,
  flyer_id UUID NOT NULL,
  question TEXT NOT NULL DEFAULT '',
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  multiple_choice BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads polls of published flyers"
  ON public.polls FOR SELECT
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = polls.flyer_id AND f.status = 'published'));

CREATE POLICY "owner full access polls"
  ON public.polls FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = polls.flyer_id AND f.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = polls.flyer_id AND f.owner_id = auth.uid()));

CREATE TRIGGER polls_set_updated_at
  BEFORE UPDATE ON public.polls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Poll votes (anonymous, deduped per session)
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  flyer_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, session_id, option_id)
);

CREATE INDEX IF NOT EXISTS poll_votes_poll_id_idx ON public.poll_votes(poll_id);

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

-- Enable realtime for live results
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
ALTER TABLE public.poll_votes REPLICA IDENTITY FULL;