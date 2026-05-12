-- Category enum
do $$ begin
  create type public.flyer_category as enum ('business','event');
exception when duplicate_object then null; end $$;

-- Columns
alter table public.flyers
  add column if not exists category public.flyer_category not null default 'business',
  add column if not exists event_date date,
  add column if not exists auto_unpublish_at timestamptz;

-- Trigger: keep auto_unpublish_at in sync (day after event_date for events; null otherwise)
create or replace function public.flyers_sync_auto_unpublish()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.category = 'event' and new.event_date is not null then
    new.auto_unpublish_at := (new.event_date + interval '1 day')::timestamptz;
  else
    new.auto_unpublish_at := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_flyers_sync_auto_unpublish on public.flyers;
create trigger trg_flyers_sync_auto_unpublish
  before insert or update of category, event_date on public.flyers
  for each row execute function public.flyers_sync_auto_unpublish();

-- Function to unpublish expired event flyers
create or replace function public.unpublish_expired_events()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.flyers
     set status = 'draft'
   where category = 'event'
     and status = 'published'
     and auto_unpublish_at is not null
     and auto_unpublish_at <= now();
  get diagnostics n = row_count;
  return n;
end $$;

-- Schedule daily unpublish (pg_cron)
create extension if not exists pg_cron;

do $$ begin
  perform cron.unschedule('unpublish-expired-event-flyers');
exception when others then null; end $$;

select cron.schedule(
  'unpublish-expired-event-flyers',
  '0 * * * *',
  $$ select public.unpublish_expired_events(); $$
);