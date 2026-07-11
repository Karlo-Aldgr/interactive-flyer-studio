-- Customer Meta OAuth: one-time states + service-role-only page token secrets.

create table if not exists public.meta_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  return_to text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.meta_oauth_states enable row level security;

-- No client policies: only service role can read/write oauth states.

create table if not exists public.meta_connection_secrets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  page_access_token text not null,
  updated_at timestamptz not null default now()
);

alter table public.meta_connection_secrets enable row level security;

-- No client policies: tokens are only accessible via service role in edge functions.

create trigger set_meta_connection_secrets_updated_at
before update on public.meta_connection_secrets
for each row
execute function public.set_updated_at();

-- Allow oauth connection_mode on meta_connections (soft: stored as text already).
comment on column public.meta_connections.connection_mode is
  'manual_test | oauth';
