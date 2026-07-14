-- Phase 4: Google Ads copy drafts (copy-only; no Ads API).
alter table public.marketing_drafts
  add column if not exists google_ads_headline text,
  add column if not exists google_ads_description text;

comment on column public.marketing_drafts.google_ads_headline is
  'AI or manual Google Ads headline (copy/paste; no Ads API in v1)';
comment on column public.marketing_drafts.google_ads_description is
  'AI or manual Google Ads description (copy/paste; no Ads API in v1)';
