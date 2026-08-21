-- Add video + copyright fields (safe if bizads table already exists from earlier migration).

ALTER TABLE public.bizads
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS copyright_text text;
