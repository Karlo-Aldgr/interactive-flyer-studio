alter table public.meta_connections
  add column if not exists instagram_user_id text,
  add column if not exists instagram_username text;

alter table public.marketing_drafts
  add column if not exists instagram_provider_status text not null default 'not_connected',
  add column if not exists instagram_provider_post_id text,
  add column if not exists instagram_last_attempt_at timestamptz,
  add column if not exists instagram_last_error text;
