-- Per-card social share image + Vontastic navy page background default.
ALTER TABLE public.bizads
  ADD COLUMN IF NOT EXISTS share_image_url text,
  ALTER COLUMN background_color SET DEFAULT '#0f172a';
