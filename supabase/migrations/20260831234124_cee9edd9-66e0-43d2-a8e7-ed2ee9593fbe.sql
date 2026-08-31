create table if not exists public.integration_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  last_tested_at timestamptz,
  last_test_ok boolean,
  last_test_message text
);

revoke all on public.integration_secrets from anon;
revoke all on public.integration_secrets from authenticated;
grant all on public.integration_secrets to service_role;

alter table public.integration_secrets enable row level security;