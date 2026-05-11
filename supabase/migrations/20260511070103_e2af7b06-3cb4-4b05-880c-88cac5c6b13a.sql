
-- Add portal token + access code to flyers
ALTER TABLE public.flyers
  ADD COLUMN IF NOT EXISTS portal_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS portal_access_code text NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

CREATE UNIQUE INDEX IF NOT EXISTS flyers_portal_token_key ON public.flyers(portal_token);

-- Backfill any existing rows that share a default (shouldn't but be safe)
UPDATE public.flyers SET portal_token = gen_random_uuid() WHERE portal_token IS NULL;
UPDATE public.flyers SET portal_access_code = upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)) WHERE portal_access_code IS NULL;
