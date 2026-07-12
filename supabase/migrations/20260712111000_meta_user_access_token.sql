-- Store long-lived user token for Instagram Graph lookups (Business Manager pages).
alter table public.meta_connection_secrets
  add column if not exists user_access_token text;
