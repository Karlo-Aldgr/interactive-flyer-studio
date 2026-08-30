-- IF -> THEN automation foundation (Phase 2A).
-- This migration creates private, tenant-scoped definitions and operational
-- records. It does not connect public events or execute workflows.

CREATE OR REPLACE FUNCTION public.automation_account_can_manage(
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
        SELECT 1
        FROM public.jobs j
        WHERE j.flyer_id = _flyer_id
          AND j.assigned_editor_id = auth.uid()
      )
    )
  )
$$;

REVOKE ALL ON FUNCTION public.automation_account_can_manage(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.automation_account_can_manage(uuid, uuid) TO authenticated;

CREATE TABLE public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  flyer_id uuid REFERENCES public.flyers(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  trigger_type text NOT NULL CHECK (trigger_type IN (
    'flyer_viewed', 'flyer_tapped', 'hotspot_clicked', 'qr_scanned',
    'form_submitted', 'lead_created', 'appointment_booked', 'flyer_shared',
    'bizad_viewed', 'bizad_action_clicked', 'date_time_reached',
    'customer_action_completed'
  )),
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(trigger_config) = 'object'),
  draft_definition jsonb NOT NULL DEFAULT '{"conditions":{"match":"all","items":[]},"steps":[]}'::jsonb
    CHECK (jsonb_typeof(draft_definition) = 'object'),
  draft_revision integer NOT NULL DEFAULT 1 CHECK (draft_revision > 0),
  published_version_id uuid,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, account_id)
);

CREATE TABLE public.automation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  trigger_type text NOT NULL CHECK (trigger_type IN (
    'flyer_viewed', 'flyer_tapped', 'hotspot_clicked', 'qr_scanned',
    'form_submitted', 'lead_created', 'appointment_booked', 'flyer_shared',
    'bizad_viewed', 'bizad_action_clicked', 'date_time_reached',
    'customer_action_completed'
  )),
  trigger_config jsonb NOT NULL CHECK (jsonb_typeof(trigger_config) = 'object'),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  published_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (automation_id, version),
  UNIQUE (id, automation_id),
  UNIQUE (id, account_id),
  UNIQUE (id, automation_id, account_id),
  FOREIGN KEY (automation_id, account_id)
    REFERENCES public.automations(id, account_id) ON DELETE CASCADE
);

ALTER TABLE public.automations
  ADD CONSTRAINT automations_published_version_fk
  FOREIGN KEY (published_version_id, id)
  REFERENCES public.automation_versions(id, automation_id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.automation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  version_id uuid NOT NULL,
  step_key text NOT NULL CHECK (char_length(btrim(step_key)) BETWEEN 1 AND 100),
  position integer NOT NULL CHECK (position >= 0),
  step_type text NOT NULL CHECK (step_type IN ('action', 'wait', 'condition', 'workflow')),
  action_type text CHECK (action_type IS NULL OR action_type IN (
    'show_popup', 'open_url', 'open_internal_page', 'open_bizad',
    'open_phone_dialer', 'open_email', 'open_sms', 'save_lead', 'update_lead',
    'send_notification', 'send_email', 'trigger_webhook', 'update_record',
    'wait', 'continue_workflow'
  )),
  config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config) = 'object'),
  next_step_key text,
  on_true_step_key text,
  on_false_step_key text,
  retry_policy jsonb NOT NULL DEFAULT '{"maxAttempts":1}'::jsonb CHECK (jsonb_typeof(retry_policy) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (version_id, automation_id, account_id)
    REFERENCES public.automation_versions(id, automation_id, account_id) ON DELETE CASCADE,
  UNIQUE (version_id, step_key),
  UNIQUE (version_id, position),
  UNIQUE (id, version_id),
  UNIQUE (id, account_id)
);

CREATE TABLE public.automation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  flyer_id uuid REFERENCES public.flyers(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (char_length(btrim(event_type)) BETWEEN 1 AND 80),
  source_type text NOT NULL CHECK (char_length(btrim(source_type)) BETWEEN 1 AND 80),
  source_id text,
  session_id text,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 255),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, idempotency_key),
  UNIQUE (id, account_id)
);

CREATE TABLE public.automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.automation_versions(id) ON DELETE RESTRICT,
  event_id uuid REFERENCES public.automation_events(id) ON DELETE SET NULL,
  root_execution_id uuid,
  parent_execution_id uuid,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'waiting', 'succeeded', 'failed', 'cancelled')),
  current_step_key text,
  workflow_depth integer NOT NULL DEFAULT 0 CHECK (workflow_depth BETWEEN 0 AND 20),
  step_count integer NOT NULL DEFAULT 0 CHECK (step_count BETWEEN 0 AND 1000),
  is_test boolean NOT NULL DEFAULT false,
  input jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(input) = 'object'),
  output jsonb CHECK (output IS NULL OR jsonb_typeof(output) = 'object'),
  error_code text,
  error_message text CHECK (error_message IS NULL OR char_length(error_message) <= 4000),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (root_execution_id) REFERENCES public.automation_executions(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_execution_id) REFERENCES public.automation_executions(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX automation_executions_event_once_idx
  ON public.automation_executions (automation_id, event_id)
  WHERE event_id IS NOT NULL AND is_test = false;

CREATE TABLE public.automation_step_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  execution_id uuid NOT NULL REFERENCES public.automation_executions(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.automation_versions(id) ON DELETE RESTRICT,
  step_id uuid REFERENCES public.automation_steps(id) ON DELETE SET NULL,
  step_key text NOT NULL,
  attempt integer NOT NULL DEFAULT 1 CHECK (attempt BETWEEN 1 AND 100),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'waiting', 'succeeded', 'failed', 'skipped', 'cancelled')),
  input jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(input) = 'object'),
  output jsonb CHECK (output IS NULL OR jsonb_typeof(output) = 'object'),
  error_code text,
  error_message text CHECK (error_message IS NULL OR char_length(error_message) <= 4000),
  started_at timestamptz,
  completed_at timestamptz,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (execution_id, step_key, attempt),
  UNIQUE (id, account_id)
);

CREATE TABLE public.automation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  execution_id uuid NOT NULL REFERENCES public.automation_executions(id) ON DELETE CASCADE,
  step_execution_id uuid REFERENCES public.automation_step_executions(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('wait', 'retry', 'resume')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'completed', 'failed', 'cancelled')),
  due_at timestamptz NOT NULL,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  claimed_by text,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 100),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 100),
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 255),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  last_error text CHECK (last_error IS NULL OR char_length(last_error) <= 4000),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, idempotency_key)
);

CREATE INDEX automations_account_status_trigger_idx
  ON public.automations(account_id, status, trigger_type);
CREATE INDEX automations_account_flyer_trigger_idx
  ON public.automations(account_id, flyer_id, status, trigger_type);
CREATE INDEX automation_versions_account_automation_idx
  ON public.automation_versions(account_id, automation_id, version DESC);
CREATE INDEX automation_steps_account_version_idx
  ON public.automation_steps(account_id, version_id, position);
CREATE INDEX automation_events_account_occurred_idx
  ON public.automation_events(account_id, occurred_at DESC);
CREATE INDEX automation_events_match_idx
  ON public.automation_events(account_id, flyer_id, event_type, occurred_at DESC);
CREATE INDEX automation_executions_account_created_idx
  ON public.automation_executions(account_id, created_at DESC);
CREATE INDEX automation_executions_account_automation_idx
  ON public.automation_executions(account_id, automation_id, created_at DESC);
CREATE INDEX automation_step_executions_account_execution_idx
  ON public.automation_step_executions(account_id, execution_id, created_at);
CREATE INDEX automation_jobs_due_idx
  ON public.automation_jobs(status, due_at) WHERE status = 'pending';
CREATE INDEX automation_jobs_account_due_idx
  ON public.automation_jobs(account_id, status, due_at);

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
  IF auth.uid() IS NOT NULL AND NOT public.automation_account_can_manage(_resolved_account, NEW.flyer_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  NEW.account_id := _resolved_account;
  IF NEW.status = 'active' AND NEW.published_version_id IS NULL THEN
    RAISE EXCEPTION 'an active automation requires a published version';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  END IF;
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  RETURN NEW;
END
$$;

CREATE TRIGGER automations_resolve_tenant
BEFORE INSERT OR UPDATE ON public.automations
FOR EACH ROW EXECUTE FUNCTION public.automation_resolve_definition_tenant();

CREATE TRIGGER automations_set_updated_at
BEFORE UPDATE ON public.automations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER automation_executions_set_updated_at
BEFORE UPDATE ON public.automation_executions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER automation_jobs_set_updated_at
BEFORE UPDATE ON public.automation_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.automation_guard_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'published automation records are immutable';
END
$$;

CREATE TRIGGER automation_versions_immutable
BEFORE UPDATE ON public.automation_versions
FOR EACH ROW EXECUTE FUNCTION public.automation_guard_immutable();
CREATE TRIGGER automation_steps_immutable
BEFORE UPDATE ON public.automation_steps
FOR EACH ROW EXECUTE FUNCTION public.automation_guard_immutable();

CREATE OR REPLACE FUNCTION public.automation_resolve_operational_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _account uuid;
  _version uuid;
BEGIN
  IF TG_TABLE_NAME = 'automation_events' THEN
    IF NEW.flyer_id IS NOT NULL THEN
      SELECT owner_id INTO _account FROM public.flyers WHERE id = NEW.flyer_id;
      IF _account IS NULL THEN RAISE EXCEPTION 'unknown flyer'; END IF;
      NEW.account_id := _account;
    ELSIF NEW.account_id IS NULL THEN
      RAISE EXCEPTION 'account_id is required for non-flyer server events';
    END IF;
  ELSIF TG_TABLE_NAME = 'automation_executions' THEN
    SELECT account_id INTO _account
      FROM public.automations WHERE id = NEW.automation_id;
    SELECT id INTO _version FROM public.automation_versions
      WHERE id = NEW.version_id
        AND automation_id = NEW.automation_id
        AND account_id = _account;
    IF _account IS NULL OR _version IS NULL THEN
      RAISE EXCEPTION 'execution automation/version mismatch';
    END IF;
    IF NEW.event_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.automation_events e
      WHERE e.id = NEW.event_id AND e.account_id = _account
    ) THEN RAISE EXCEPTION 'execution event tenant mismatch'; END IF;
    IF NEW.root_execution_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.automation_executions e
      WHERE e.id = NEW.root_execution_id AND e.account_id = _account
    ) THEN RAISE EXCEPTION 'root execution tenant mismatch'; END IF;
    IF NEW.parent_execution_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.automation_executions e
      WHERE e.id = NEW.parent_execution_id AND e.account_id = _account
    ) THEN RAISE EXCEPTION 'parent execution tenant mismatch'; END IF;
    NEW.account_id := _account;
  ELSIF TG_TABLE_NAME = 'automation_step_executions' THEN
    SELECT account_id, version_id INTO _account, _version
      FROM public.automation_executions WHERE id = NEW.execution_id;
    IF _account IS NULL OR _version IS DISTINCT FROM NEW.version_id THEN
      RAISE EXCEPTION 'step execution version mismatch';
    END IF;
    IF NEW.step_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.automation_steps s
      WHERE s.id = NEW.step_id AND s.version_id = _version AND s.account_id = _account
    ) THEN RAISE EXCEPTION 'step execution tenant mismatch'; END IF;
    NEW.account_id := _account;
  ELSIF TG_TABLE_NAME = 'automation_jobs' THEN
    SELECT account_id INTO _account FROM public.automation_executions WHERE id = NEW.execution_id;
    IF _account IS NULL THEN RAISE EXCEPTION 'unknown execution'; END IF;
    IF NEW.step_execution_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.automation_step_executions se
      WHERE se.id = NEW.step_execution_id
        AND se.execution_id = NEW.execution_id
        AND se.account_id = _account
    ) THEN RAISE EXCEPTION 'job step tenant mismatch'; END IF;
    NEW.account_id := _account;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER automation_events_resolve_tenant
BEFORE INSERT OR UPDATE ON public.automation_events
FOR EACH ROW EXECUTE FUNCTION public.automation_resolve_operational_tenant();
CREATE TRIGGER automation_executions_resolve_tenant
BEFORE INSERT OR UPDATE ON public.automation_executions
FOR EACH ROW EXECUTE FUNCTION public.automation_resolve_operational_tenant();
CREATE TRIGGER automation_step_executions_resolve_tenant
BEFORE INSERT OR UPDATE ON public.automation_step_executions
FOR EACH ROW EXECUTE FUNCTION public.automation_resolve_operational_tenant();
CREATE TRIGGER automation_jobs_resolve_tenant
BEFORE INSERT OR UPDATE ON public.automation_jobs
FOR EACH ROW EXECUTE FUNCTION public.automation_resolve_operational_tenant();

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
  IF NOT FOUND OR NOT public.automation_account_can_manage(_automation.account_id, _automation.flyer_id) THEN
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
      COALESCE(NULLIF(btrim(_step->>'key'), ''), 'step_' || _position),
      _position,
      COALESCE(NULLIF(_step->>'type', ''), 'action'),
      NULLIF(_step->>'actionType', ''),
      COALESCE(_step->'config', '{}'::jsonb),
      NULLIF(_step->>'nextStepKey', ''),
      NULLIF(_step->>'onTrueStepKey', ''),
      NULLIF(_step->>'onFalseStepKey', ''),
      COALESCE(_step->'retryPolicy', '{"maxAttempts":1}'::jsonb)
    );
    _position := _position + 1;
  END LOOP;

  UPDATE public.automations
    SET published_version_id = _version_id,
        status = CASE WHEN status = 'archived' THEN 'draft' ELSE status END,
        updated_by = auth.uid(),
        updated_at = now()
    WHERE id = _automation.id;
  RETURN _version_id;
END
$$;

REVOKE ALL ON FUNCTION public.publish_automation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_automation(uuid) TO authenticated;

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_step_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation definitions tenant read" ON public.automations
  FOR SELECT TO authenticated
  USING (public.automation_account_can_manage(account_id, flyer_id));
CREATE POLICY "automation definitions tenant insert" ON public.automations
  FOR INSERT TO authenticated
  WITH CHECK (public.automation_account_can_manage(account_id, flyer_id));
CREATE POLICY "automation definitions tenant update" ON public.automations
  FOR UPDATE TO authenticated
  USING (public.automation_account_can_manage(account_id, flyer_id))
  WITH CHECK (public.automation_account_can_manage(account_id, flyer_id));
CREATE POLICY "automation definitions tenant delete" ON public.automations
  FOR DELETE TO authenticated
  USING (public.automation_account_can_manage(account_id, flyer_id));

CREATE POLICY "automation versions tenant read" ON public.automation_versions
  FOR SELECT TO authenticated
  USING (public.automation_account_can_manage(account_id, (
    SELECT a.flyer_id FROM public.automations a WHERE a.id = automation_id
  )));
CREATE POLICY "automation steps tenant read" ON public.automation_steps
  FOR SELECT TO authenticated
  USING (public.automation_account_can_manage(account_id, (
    SELECT a.flyer_id FROM public.automations a WHERE a.id = automation_id
  )));
CREATE POLICY "automation events tenant read" ON public.automation_events
  FOR SELECT TO authenticated
  USING (public.automation_account_can_manage(account_id, flyer_id));
CREATE POLICY "automation executions tenant read" ON public.automation_executions
  FOR SELECT TO authenticated
  USING (public.automation_account_can_manage(account_id, (
    SELECT a.flyer_id FROM public.automations a WHERE a.id = automation_id
  )));
CREATE POLICY "automation step executions tenant read" ON public.automation_step_executions
  FOR SELECT TO authenticated
  USING (public.automation_account_can_manage(account_id, (
    SELECT a.flyer_id FROM public.automation_executions e
    JOIN public.automations a ON a.id = e.automation_id
    WHERE e.id = execution_id
  )));
CREATE POLICY "automation jobs tenant read" ON public.automation_jobs
  FOR SELECT TO authenticated
  USING (public.automation_account_can_manage(account_id, (
    SELECT a.flyer_id FROM public.automation_executions e
    JOIN public.automations a ON a.id = e.automation_id
    WHERE e.id = execution_id
  )));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO authenticated;
GRANT SELECT ON public.automation_versions TO authenticated;
GRANT SELECT ON public.automation_steps TO authenticated;
GRANT SELECT ON public.automation_events TO authenticated;
GRANT SELECT ON public.automation_executions TO authenticated;
GRANT SELECT ON public.automation_step_executions TO authenticated;
GRANT SELECT ON public.automation_jobs TO authenticated;

GRANT ALL ON public.automations TO service_role;
GRANT ALL ON public.automation_versions TO service_role;
GRANT ALL ON public.automation_steps TO service_role;
GRANT ALL ON public.automation_events TO service_role;
GRANT ALL ON public.automation_executions TO service_role;
GRANT ALL ON public.automation_step_executions TO service_role;
GRANT ALL ON public.automation_jobs TO service_role;

COMMENT ON TABLE public.automations IS 'Private account-owned IF/THEN automation drafts.';
COMMENT ON TABLE public.automation_versions IS 'Immutable published automation definition snapshots.';
COMMENT ON TABLE public.automation_events IS 'Private canonical event ledger; populated only by trusted server code.';
COMMENT ON TABLE public.automation_jobs IS 'Private durable WAIT/retry/resume jobs; no processor is enabled in Phase 2A.';
