UPDATE public.bizads
SET business_name = 'GOD''S WARRIOR',
    owner_name = NULL,
    about_text = NULL,
    copyright_text = 'GOD''SWARRIOR 2021',
    updated_at = now()
WHERE flyer_id = '230d4be2-aca2-4dc9-b0c5-794b64161cb4';

UPDATE public.layers
SET content = replace(replace(replace(content::text, 'VONTASTIC''S', 'GOD''S WARRIOR'), 'Vontastic''s', 'GOD''S WARRIOR'), 'Vontastic', 'GOD''S WARRIOR')::jsonb
WHERE page_id = 'bb8dd5b0-692c-4aa0-9c8b-600f69bedf7b'
  AND content::text ILIKE '%vontastic%';