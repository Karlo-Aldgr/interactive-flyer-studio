
DROP POLICY IF EXISTS "anyone updates own session rating" ON public.business_ratings;

CREATE POLICY "update own session rating"
ON public.business_ratings
FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.flyers f
    WHERE f.id = business_ratings.flyer_id
      AND f.status = 'published'::flyer_status
  )
  AND session_id IS NOT NULL
  AND session_id = current_setting('request.headers', true)::json->>'x-session-id'
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.flyers f
    WHERE f.id = business_ratings.flyer_id
      AND f.status = 'published'::flyer_status
  )
  AND session_id IS NOT NULL
  AND session_id = current_setting('request.headers', true)::json->>'x-session-id'
);
