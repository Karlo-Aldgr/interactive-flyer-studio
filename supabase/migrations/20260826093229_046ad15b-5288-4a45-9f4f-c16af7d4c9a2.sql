ALTER TABLE public.bizads
  ADD COLUMN IF NOT EXISTS template_id text NOT NULL DEFAULT 'vontastic_v1',
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS custom_link_label text,
  ADD COLUMN IF NOT EXISTS custom_link_url text,
  ADD COLUMN IF NOT EXISTS booking_url text,
  ADD COLUMN IF NOT EXISTS accent_color text,
  ADD COLUMN IF NOT EXISTS gradient_from text,
  ADD COLUMN IF NOT EXISTS gradient_to text;