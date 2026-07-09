create table if not exists public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'meta',
  meta_app_id text,
  connection_mode text not null default 'manual_test',
  status text not null default 'not_connected' check (status in ('not_connected', 'connected', 'ready', 'error')),
  facebook_page_id text,
  facebook_page_name text,
  page_access_token_last4 text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.meta_connections enable row level security;

create policy "Owners can read their meta connections"
on public.meta_connections
for select
using (
  auth.uid() = user_id
  or public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'editor')
);

create policy "Owners can insert their meta connections"
on public.meta_connections
for insert
with check (
  auth.uid() = user_id
  or public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'editor')
);

create policy "Owners can update their meta connections"
on public.meta_connections
for update
using (
  auth.uid() = user_id
  or public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'editor')
)
with check (
  auth.uid() = user_id
  or public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'editor')
);

create policy "Owners can delete their meta connections"
on public.meta_connections
for delete
using (
  auth.uid() = user_id
  or public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'editor')
);

create trigger set_meta_connections_updated_at
before update on public.meta_connections
for each row
execute function public.set_updated_at();

alter table public.marketing_drafts
  add column if not exists facebook_provider_status text not null default 'not_connected',
  add column if not exists facebook_provider_post_id text,
  add column if not exists facebook_last_attempt_at timestamptz,
  add column if not exists facebook_last_error text;
