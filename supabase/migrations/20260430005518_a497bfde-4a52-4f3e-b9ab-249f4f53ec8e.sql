ALTER TYPE action_type ADD VALUE IF NOT EXISTS 'audio';
ALTER TABLE public.actions ADD COLUMN IF NOT EXISTS highlight jsonb;