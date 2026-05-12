-- Enums
do $$ begin
  create type public.job_type as enum ('upload','design');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.job_status as enum ('new','reviewing','quoted','paid','in_progress','preview_ready','delivered','cancelled');
exception when duplicate_object then null; end $$;

-- Jobs table
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  customer_email text,
  type public.job_type not null,
  title text not null default 'Untitled job',
  brief text,
  upload_url text,
  selected_actions jsonb not null default '[]'::jsonb,
  status public.job_status not null default 'new',
  price_cents integer,
  payment_link text,
  admin_notes text,
  flyer_id uuid,
  preview_ready boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_user_id_idx on public.jobs(user_id);
create index if not exists jobs_status_idx on public.jobs(status);
create index if not exists jobs_created_at_idx on public.jobs(created_at desc);

alter table public.jobs enable row level security;

drop policy if exists "users see own jobs" on public.jobs;
create policy "users see own jobs" on public.jobs for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users insert own jobs" on public.jobs;
create policy "users insert own jobs" on public.jobs for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "admins read all jobs" on public.jobs;
create policy "admins read all jobs" on public.jobs for select to authenticated using (public.has_role(auth.uid(),'admin'));

drop policy if exists "admins update all jobs" on public.jobs;
create policy "admins update all jobs" on public.jobs for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

drop policy if exists "admins delete jobs" on public.jobs;
create policy "admins delete jobs" on public.jobs for delete to authenticated using (public.has_role(auth.uid(),'admin'));

drop trigger if exists trg_jobs_updated_at on public.jobs;
create trigger trg_jobs_updated_at before update on public.jobs for each row execute function public.set_updated_at();

-- Admin can update / delete any flyer
drop policy if exists "admins update any flyer" on public.flyers;
create policy "admins update any flyer" on public.flyers for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

drop policy if exists "admins delete any flyer" on public.flyers;
create policy "admins delete any flyer" on public.flyers for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- App settings (admin-only key/value store; used for backup tracking)
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "admins read settings" on public.app_settings;
create policy "admins read settings" on public.app_settings for select to authenticated using (public.has_role(auth.uid(),'admin'));

drop policy if exists "admins write settings" on public.app_settings;
create policy "admins write settings" on public.app_settings for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at before update on public.app_settings for each row execute function public.set_updated_at();

-- Storage bucket for job uploads
insert into storage.buckets (id, name, public)
values ('job-uploads','job-uploads', true)
on conflict (id) do nothing;

drop policy if exists "anyone read job-uploads" on storage.objects;
create policy "anyone read job-uploads" on storage.objects for select to anon, authenticated using (bucket_id = 'job-uploads');

drop policy if exists "auth users upload job-uploads own folder" on storage.objects;
create policy "auth users upload job-uploads own folder" on storage.objects for insert to authenticated with check (bucket_id = 'job-uploads' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "auth users update own job-uploads" on storage.objects;
create policy "auth users update own job-uploads" on storage.objects for update to authenticated using (bucket_id = 'job-uploads' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "admins delete job-uploads" on storage.objects;
create policy "admins delete job-uploads" on storage.objects for delete to authenticated using (bucket_id = 'job-uploads' and public.has_role(auth.uid(),'admin'));