-- Long-lived Instagram Login user token (60 days) + expiry for refresh.
alter table public.meta_connection_secrets
  add column if not exists instagram_user_access_token text,
  add column if not exists instagram_token_expires_at timestamptz;

comment on column public.meta_connection_secrets.instagram_user_access_token is
  'Instagram Login long-lived user access token for Content Publishing (graph.instagram.com)';
comment on column public.meta_connection_secrets.instagram_token_expires_at is
  'When instagram_user_access_token expires; refresh before this with ig_refresh_token';
