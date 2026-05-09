-- 1. Extend action_type enum
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'subscribe';

-- 2. Subscribers table
CREATE TABLE IF NOT EXISTS public.subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_id uuid NOT NULL,
  layer_id uuid,
  name text,
  email text NOT NULL,
  phone text,
  list_name text,
  source text NOT NULL DEFAULT 'subscribe',
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscribers_flyer_email_uniq
  ON public.subscribers (flyer_id, lower(email));

CREATE INDEX IF NOT EXISTS subscribers_flyer_created_idx
  ON public.subscribers (flyer_id, created_at DESC);

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe to a published flyer
CREATE POLICY "anyone can subscribe to published flyers"
ON public.subscribers
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.flyers f
    WHERE f.id = subscribers.flyer_id AND f.status = 'published'::flyer_status
  )
);

-- Owner full access (read, update, delete)
CREATE POLICY "owner reads subscribers"
ON public.subscribers
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = subscribers.flyer_id AND f.owner_id = auth.uid())
);

CREATE POLICY "owner updates subscribers"
ON public.subscribers
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = subscribers.flyer_id AND f.owner_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = subscribers.flyer_id AND f.owner_id = auth.uid())
);

CREATE POLICY "owner deletes subscribers"
ON public.subscribers
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = subscribers.flyer_id AND f.owner_id = auth.uid())
);

-- updated_at trigger
DROP TRIGGER IF EXISTS subscribers_set_updated_at ON public.subscribers;
CREATE TRIGGER subscribers_set_updated_at
BEFORE UPDATE ON public.subscribers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();