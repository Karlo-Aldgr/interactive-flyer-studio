-- Phase 4: TikTok caption + SMS body drafts (copy-only; no send API).
alter table public.marketing_drafts
  add column if not exists tiktok_caption text,
  add column if not exists sms_body text;

comment on column public.marketing_drafts.tiktok_caption is
  'AI or manual TikTok caption for flyer marketing (copy/paste; no auto-post in v1)';
comment on column public.marketing_drafts.sms_body is
  'AI or manual SMS text for flyer marketing (copy/paste; no auto-send in v1)';
