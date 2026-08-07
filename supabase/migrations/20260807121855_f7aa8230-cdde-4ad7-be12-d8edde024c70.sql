CREATE TABLE public.api_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  key_id uuid not null references public.api_keys(id) on delete cascade,
  idempotency_key text not null,
  request_fingerprint text,
  request_id uuid not null,
  state text not null default 'in_progress',
  http_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  unique (key_id, idempotency_key)
);

GRANT ALL ON public.api_idempotency_keys TO service_role;
ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their idempotency records"
ON public.api_idempotency_keys FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.api_keys k WHERE k.id = api_idempotency_keys.key_id AND k.owner_id = auth.uid()));

CREATE INDEX idx_api_idempotency_expires ON public.api_idempotency_keys(expires_at);