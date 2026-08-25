-- Default bizad theme: Vontastic / TapThatFlyer standard (orange buttons, navy page).
ALTER TABLE public.bizads
  ALTER COLUMN button_color SET DEFAULT '#f97316',
  ALTER COLUMN background_color SET DEFAULT '#0f172a';
