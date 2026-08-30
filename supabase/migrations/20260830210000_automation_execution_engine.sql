-- Phase 2C: read/mutation authorization separation and secure runtime support.
-- This migration does not deploy or schedule the automation engine.

CREATE OR REPLACE FUNCTION public.automation_account_can_read(
  _account_id uuid,
  _flyer_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    auth.uid() = _account_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      _flyer_id IS NOT NULL
      AND public.has_role(auth.uid(), 'editor'::public.app_role)
      AND EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.flyer_id = _flyer_id AND j.assigned_editor_id = auth.uid()
      )
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.automation_account_can_mutate(
  _account_id uuid,
  _flyer_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    auth.uid() = _account_id
    OR (
      _flyer_id IS NOT NULL
      AND public.has_role(auth.uid(), 'editor'::public.app_role)
      AND EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.flyer_id = _flyer_id AND j.assigned_editor_id = auth.uid()
      )
    )
  )
$$;

REVOKE ALL ON FUNCTION public.automation_account_can_read(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.automation_account_can_mutate(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.automation_account_can_read(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.automation_account_can_mutate(uuid, uuid) TO authenticated;

-- Keep the Phase 2A name as a read-only compatibility alias. Runtime code never
-- uses this function to determine which tenant may execute.
CREATE OR REPLACE FUNCTION public.automation_account_can_manage(
  _account_id uuid,
  _flyer_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.automation_account_can_read(_account_id, _flyer_id) $$;

CREATE OR REPLACE FUNCTION public.automation_resolve_definition_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _resolved_account uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.account_id IS DISTINCT FROM OLD.account_id THEN
    RAISE EXCEPTION 'automation account_id is immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.draft_definition IS DISTINCT FROM OLD.draft_definition THEN
    NEW.draft_revision := OLD.draft_revision + 1;
  END IF;
  IF NEW.flyer_id IS NOT NULL THEN
    SELECT owner_id INTO _resolved_account FROM public.flyers WHERE id = NEW.flyer_id;
    IF _resolved_account IS NULL THEN RAISE EXCEPTION 'unknown flyer'; END IF;
  ELSE
    _resolved_account := COALESCE(CASE WHEN auth.uid() IS NOT NULL THEN auth.uid() END, NEW.account_id);
  END IF;
  IF _resolved_account IS NULL THEN RAISE EXCEPTION 'account could not be resolved'; END IF;
  IF auth.uid() IS NOT NULL AND NOT public.automation_account_can_mutate(_resolved_account, NEW.flyer_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  NEW.account_id := _resolved_account;
  IF NEW.status = 'active' AND NEW.published_version_id IS NULL THEN
    RAISE EXCEPTION 'an active automation requires a published version';
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.created_by := COALESCE(auth.uid(), NEW.created_by); END IF;
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.publish_automation(_automation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _automation public.automations%ROWTYPE;
  _version_number integer;
  _version_id uuid;
  _step jsonb;
  _position integer := 0;
BEGIN
  SELECT * INTO _automation FROM public.automations WHERE id = _automation_id FOR UPDATE;
  IF NOT FOUND OR NOT public.automation_account_can_mutate(_automation.account_id, _automation.flyer_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF jsonb_typeof(_automation.draft_definition->'steps') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'draft definition steps must be an array';
  END IF;
  SELECT COALESCE(max(version), 0) + 1 INTO _version_number
    FROM public.automation_versions WHERE automation_id = _automation.id;
  INSERT INTO public.automation_versions (
    account_id, automation_id, version, trigger_type, trigger_config, definition, published_by
  ) VALUES (
    _automation.account_id, _automation.id, _version_number, _automation.trigger_type,
    _automation.trigger_config, _automation.draft_definition, auth.uid()
  ) RETURNING id INTO _version_id;
  FOR _step IN SELECT value FROM jsonb_array_elements(_automation.draft_definition->'steps') LOOP
    INSERT INTO public.automation_steps (
      account_id, automation_id, version_id, step_key, position, step_type, action_type,
      config, next_step_key, on_true_step_key, on_false_step_key, retry_policy
    ) VALUES (
      _automation.account_id, _automation.id, _version_id,
      COALESCE(NULLIF(btrim(_step->>'key'), ''), 'step_' || _position), _position,
      COALESCE(NULLIF(_step->>'type', ''), 'action'), NULLIF(_step->>'actionType', ''),
      COALESCE(_step->'config', '{}'::jsonb), NULLIF(_step->>'nextStepKey', ''),
      NULLIF(_step->>'onTrueStepKey', ''), NULLIF(_step->>'onFalseStepKey', ''),
      COALESCE(_step->'retryPolicy', '{"maxAttempts":1}'::jsonb)
    );
    _position := _position + 1;
  END LOOP;
  UPDATE public.automations SET published_version_id = _version_id,
    status = CASE WHEN status = 'archived' THEN 'draft' ELSE status END,
    updated_by = auth.uid(), updated_at = now() WHERE id = _automation.id;
  RETURN _version_id;
END
$$;

DROP POLICY IF EXISTS "automation definitions tenant read" ON public.automations;
DROP POLICY IF EXISTS "automation definitions tenant insert" ON public.automations;
DROP POLICY IF EXISTS "automation definitions tenant update" ON public.automations;
DROP POLICY IF EXISTS "automation definitions tenant delete" ON public.automations;
CREATE POLICY "automation definitions tenant read" ON public.automations FOR SELECT TO authenticated
  USING (public.automation_account_can_read(account_id, flyer_id));
CREATE POLICY "automation definitions tenant insert" ON public.automations FOR INSERT TO authenticated
  WITH CHECK (public.automation_account_can_mutate(account_id, flyer_id));
CREATE POLICY "automation definitions tenant update" ON public.automations FOR UPDATE TO authenticated
  USING (public.automation_account_can_mutate(account_id, flyer_id))
  WITH CHECK (public.automation_account_can_mutate(account_id, flyer_id));
CREATE POLICY "automation definitions tenant delete" ON public.automations FOR DELETE TO authenticated
  USING (public.automation_account_can_mutate(account_id, flyer_id));

DROP POLICY IF EXISTS "automation versions tenant read" ON public.automation_versions;
DROP POLICY IF EXISTS "automation steps tenant read" ON public.automation_steps;
DROP POLICY IF EXISTS "automation events tenant read" ON public.automation_events;
DROP POLICY IF EXISTS "automation executions tenant read" ON public.automation_executions;
DROP POLICY IF EXISTS "automation step executions tenant read" ON public.automation_step_executions;
DROP POLICY IF EXISTS "automation jobs tenant read" ON public.automation_jobs;
CREATE POLICY "automation versions tenant read" ON public.automation_versions FOR SELECT TO authenticated
  USING (public.automation_account_can_read(account_id, (SELECT a.flyer_id FROM public.automations a WHERE a.id = automation_id)));
CREATE POLICY "automation steps tenant read" ON public.automation_steps FOR SELECT TO authenticated
  USING (public.automation_account_can_read(account_id, (SELECT a.flyer_id FROM public.automations a WHERE a.id = automation_id)));
CREATE POLICY "automation events tenant read" ON public.automation_events FOR SELECT TO authenticated
  USING (public.automation_account_can_read(account_id, flyer_id));
CREATE POLICY "automation executions tenant read" ON public.automation_executions FOR SELECT TO authenticated
  USING (public.automation_account_can_read(account_id, (SELECT a.flyer_id FROM public.automations a WHERE a.id = automation_id)));
CREATE POLICY "automation step executions tenant read" ON public.automation_step_executions FOR SELECT TO authenticated
  USING (public.automation_account_can_read(account_id, (SELECT a.flyer_id FROM public.automation_executions e JOIN public.automations a ON a.id = e.automation_id WHERE e.id = execution_id)));
CREATE POLICY "automation jobs tenant read" ON public.automation_jobs FOR SELECT TO authenticated
  USING (public.automation_account_can_read(account_id, (SELECT a.flyer_id FROM public.automation_executions e JOIN public.automations a ON a.id = e.automation_id WHERE e.id = execution_id)));

ALTER TABLE public.automation_executions
  ADD COLUMN correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN visited_automation_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN failure_policy text NOT NULL DEFAULT 'stop' CHECK (failure_policy IN ('stop'));
ALTER TABLE public.automation_executions ADD CONSTRAINT automation_executions_id_account_unique UNIQUE (id, account_id);
ALTER TABLE public.automation_executions ADD CONSTRAINT automation_executions_id_version_account_unique UNIQUE (id, version_id, account_id);

ALTER TABLE public.automation_step_executions
  ADD CONSTRAINT automation_step_execution_owner_fk
  FOREIGN KEY (execution_id, version_id, account_id)
  REFERENCES public.automation_executions(id, version_id, account_id) ON DELETE CASCADE;
ALTER TABLE public.automation_jobs
  ADD CONSTRAINT automation_job_execution_owner_fk
  FOREIGN KEY (execution_id, account_id)
  REFERENCES public.automation_executions(id, account_id) ON DELETE CASCADE;

CREATE INDEX automation_executions_account_correlation_idx
  ON public.automation_executions(account_id, correlation_id, created_at);
CREATE INDEX automations_runtime_match_idx
  ON public.automations(account_id, trigger_type, flyer_id)
  WHERE status = 'active' AND published_version_id IS NOT NULL;

COMMENT ON COLUMN public.automation_executions.visited_automation_ids IS
  'Server-maintained chain path used for loop prevention; never accepted from public event input.';
