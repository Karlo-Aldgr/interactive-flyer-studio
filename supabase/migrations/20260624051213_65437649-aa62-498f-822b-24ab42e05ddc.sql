CREATE OR REPLACE FUNCTION public.pick_mini_ad(_exclude_id uuid DEFAULT NULL)
 RETURNS TABLE(id uuid, image_url text, click_url text, alt_text text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH eligible AS (
    SELECT m.id, m.image_url, m.click_url, m.alt_text, m.weight
    FROM public.mini_ads m
    WHERE m.active = true
      AND (m.starts_at IS NULL OR m.starts_at <= now())
      AND (m.ends_at IS NULL OR m.ends_at >= now())
  ),
  filtered AS (
    SELECT * FROM eligible
    WHERE _exclude_id IS NULL
       OR id <> _exclude_id
       OR (SELECT count(*) FROM eligible) <= 1
  )
  SELECT id, image_url, click_url, alt_text
  FROM filtered
  ORDER BY random() * (1.0 / GREATEST(weight, 1))
  LIMIT 1;
$function$;