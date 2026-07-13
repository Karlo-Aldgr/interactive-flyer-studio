-- Phase 4 MVP: AI email draft fields (copy-only; no send).
alter table public.marketing_drafts
  add column if not exists email_subject text,
  add column if not exists email_body text;

comment on column public.marketing_drafts.email_subject is
  'AI or manual email subject line for flyer marketing (copy/paste; no auto-send in v1)';
comment on column public.marketing_drafts.email_body is
  'AI or manual email body for flyer marketing (copy/paste; no auto-send in v1)';
