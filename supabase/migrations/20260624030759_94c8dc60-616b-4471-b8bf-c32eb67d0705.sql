
-- 1) waiters.pin_hash: revoke column-level SELECT so PostgREST cannot return it
REVOKE SELECT (pin_hash) ON public.waiters FROM anon, authenticated;

-- 2) flyers.owner_id: hide from anonymous public reads
REVOKE SELECT (owner_id) ON public.flyers FROM anon;

-- 3) challenge_participants: add owner UPDATE + DELETE policies
CREATE POLICY "owner updates participants"
ON public.challenge_participants
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = challenge_participants.flyer_id AND f.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = challenge_participants.flyer_id AND f.owner_id = auth.uid()));

CREATE POLICY "owner deletes participants"
ON public.challenge_participants
FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.flyers f WHERE f.id = challenge_participants.flyer_id AND f.owner_id = auth.uid()));

-- 4) jobs realtime: ensure anon cannot subscribe (RLS already restricts rows, but tighten by
--    revoking SELECT to anon entirely so misconfigured anon clients receive nothing).
REVOKE SELECT ON public.jobs FROM anon;
