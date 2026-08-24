-- Default bizad theme: Vonstatics / TapThatFlyer standard (orange buttons, light gray page).
ALTER TABLE public.bizads
  ALTER COLUMN button_color SET DEFAULT '#f97316',
  ALTER COLUMN background_color SET DEFAULT '#f3f4f6';
