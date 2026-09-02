-- Phase 2D: staging-ready history hygiene, abuse constraints, and durable job claims.
-- Local migration only. Applying or scheduling it requires explicit approval.

ALTER TABLE public.automation_events
  ADD CONSTRAINT automation_event_payload_size CHECK (pg_column_size(payload) <= 65536),
  ADD CONSTRAINT automation_event_source_id_size CHECK (source_id IS NULL OR char_length(source_id) <= 500),
  ADD CONSTRAINT automation_event_session_id_size CHECK (session_id IS NULL OR char_length(session_id) <= 500);

ALTER TABLE public.automation_jobs
  ADD CONSTRAINT automation_job_payload_size CHECK (pg_column_size(payload) <= 32768);

CREATE OR REPLACE FUNCTION public.automation_redact_json(_value jsonb, _depth integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF _value IS NULL THEN RETURN NULL; END IF;
  IF _depth > 8 THEN RETURN '"[TRUNCATED]"'::jsonb; END IF;
  IF jsonb_typeof(_value) = 'object' THEN
    SELECT COALESCE(jsonb_object_agg(key,
      CASE WHEN key ~* '(authorization|cookie|token|secret|password|api[_-]?key|service[_-]?role|credential|payment|card|cvv)'
        THEN '"[REDACTED]"'::jsonb ELSE public.automation_redact_json(value, _depth + 1) END
    ), '{}'::jsonb) INTO _result FROM jsonb_each(_value);
    RETURN _result;
  END IF;
  IF jsonb_typeof(_value) = 'array' THEN
    SELECT COALESCE(jsonb_agg(public.automation_redact_json(value, _depth + 1)), '[]'::jsonb)
      INTO _result FROM jsonb_array_elements(_value);
    RETURN _result;
  END IF;
  IF jsonb_typeof(_value) = 'string' AND char_length(_value #>> '{}') > 1000 THEN
    RETURN to_jsonb(left(_value #>> '{}', 1000) || '…');
  END IF;
  RETURN _value;
END
$$;

REVOKE ALL ON FUNCTION public.automation_redact_json(jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automation_redact_json(jsonb, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.automation_sanitize_history_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.output := public.automation_redact_json(NEW.output);
  IF NEW.error_message IS NOT NULL THEN
    NEW.error_message := left(regexp_replace(NEW.error_message, 'https?://[^[:space:]]+', '[URL REDACTED]', 'gi'), 500);
  END IF;
  IF NEW.error_code IS NOT NULL AND NEW.error_code !~ '^[A-Za-z0-9_:-]{1,100}$' THEN
    NEW.error_code := 'internal_error';
    NEW.error_message := NULL;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER automation_executions_sanitize_history
BEFORE INSERT OR UPDATE OF output, error_code, error_message ON public.automation_executions
FOR EACH ROW EXECUTE FUNCTION public.automation_sanitize_history_row();
CREATE TRIGGER automation_step_executions_sanitize_history
BEFORE INSERT OR UPDATE OF output, error_code, error_message ON public.automation_step_executions
FOR EACH ROW EXECUTE FUNCTION public.automation_sanitize_history_row();

REVOKE ALL ON FUNCTION public.automation_sanitize_history_row() FROM PUBLIC, anon, authenticated;

-- Cron/worker boundary. Only service_role can claim jobs. SKIP LOCKED allows
-- multiple workers without double-processing. The worker still must update by
-- both job id and account id, and action execution remains idempotent.
CREATE OR REPLACE FUNCTION public.claim_due_automation_jobs(_worker text, _limit integer DEFAULT 25)
RETURNS SETOF public.automation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF char_length(coalesce(_worker, '')) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid worker'; END IF;
  RETURN QUERY
  WITH due AS (
    SELECT id FROM public.automation_jobs
    WHERE status = 'pending' AND due_at <= now()
    ORDER BY due_at, id
    FOR UPDATE SKIP LOCKED
    LIMIT least(greatest(_limit, 1), 100)
  )
  UPDATE public.automation_jobs j SET
    status = 'claimed', claimed_at = now(), lease_expires_at = now() + interval '5 minutes',
    claimed_by = _worker, attempt_count = j.attempt_count + 1, updated_at = now()
  FROM due WHERE j.id = due.id
  RETURNING j.*;
END
$$;

REVOKE ALL ON FUNCTION public.claim_due_automation_jobs(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_automation_jobs(text, integer) TO service_role;

COMMENT ON FUNCTION public.claim_due_automation_jobs(text, integer) IS
  'Durable WAIT/retry worker boundary. No cron schedule is installed by this migration.';
COMMENT ON FUNCTION public.automation_redact_json(jsonb, integer) IS
  'Defense-in-depth redaction for customer/admin-visible execution output.';
