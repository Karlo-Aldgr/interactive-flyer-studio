
-- Enums
create type public.flyer_status as enum ('draft','published');
create type public.layer_type as enum ('text','image','icon','shape','button');
create type public.action_type as enum ('open_url','popup','video','call','sms','form','navigate','reveal');
create type public.event_type as enum ('view','click','submit','reveal');
create type public.app_role as enum ('admin','user');

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- Roles (separate table, has_role function)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  unique (user_id, role)
);
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create policy "users see own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

-- Flyers
create table public.flyers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled flyer',
  status public.flyer_status not null default 'draft',
  public_slug text unique,
  settings jsonb not null default '{"width":900,"height":1200,"background":"#ffffff"}'::jsonb,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.flyers enable row level security;
create trigger flyers_updated before update on public.flyers for each row execute function public.set_updated_at();
create index on public.flyers(owner_id);
create index on public.flyers(public_slug);

create policy "owner full access flyers" on public.flyers for all to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "anyone can read published flyers" on public.flyers for select to anon, authenticated
  using (status = 'published');

-- Pages
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  flyer_id uuid not null references public.flyers(id) on delete cascade,
  index int not null default 0,
  name text not null default 'Page 1',
  background jsonb not null default '{"color":"#ffffff"}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.pages enable row level security;
create index on public.pages(flyer_id);

create policy "owner full access pages" on public.pages for all to authenticated
  using (exists (select 1 from public.flyers f where f.id = flyer_id and f.owner_id = auth.uid()))
  with check (exists (select 1 from public.flyers f where f.id = flyer_id and f.owner_id = auth.uid()));
create policy "anyone reads pages of published flyers" on public.pages for select to anon, authenticated
  using (exists (select 1 from public.flyers f where f.id = flyer_id and f.status = 'published'));

-- Layers
create table public.layers (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  type public.layer_type not null,
  position jsonb not null default '{"x":0,"y":0}'::jsonb,
  size jsonb not null default '{"width":100,"height":100}'::jsonb,
  rotation numeric not null default 0,
  z_index int not null default 0,
  style jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.layers enable row level security;
create index on public.layers(page_id);

create policy "owner full access layers" on public.layers for all to authenticated
  using (exists (
    select 1 from public.pages p join public.flyers f on f.id = p.flyer_id
    where p.id = page_id and f.owner_id = auth.uid()))
  with check (exists (
    select 1 from public.pages p join public.flyers f on f.id = p.flyer_id
    where p.id = page_id and f.owner_id = auth.uid()));
create policy "anyone reads layers of published flyers" on public.layers for select to anon, authenticated
  using (exists (
    select 1 from public.pages p join public.flyers f on f.id = p.flyer_id
    where p.id = page_id and f.status = 'published'));

-- Actions
create table public.actions (
  id uuid primary key default gen_random_uuid(),
  layer_id uuid not null references public.layers(id) on delete cascade,
  type public.action_type not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.actions enable row level security;
create index on public.actions(layer_id);

create policy "owner full access actions" on public.actions for all to authenticated
  using (exists (
    select 1 from public.layers l
    join public.pages p on p.id = l.page_id
    join public.flyers f on f.id = p.flyer_id
    where l.id = layer_id and f.owner_id = auth.uid()))
  with check (exists (
    select 1 from public.layers l
    join public.pages p on p.id = l.page_id
    join public.flyers f on f.id = p.flyer_id
    where l.id = layer_id and f.owner_id = auth.uid()));
create policy "anyone reads actions of published flyers" on public.actions for select to anon, authenticated
  using (exists (
    select 1 from public.layers l
    join public.pages p on p.id = l.page_id
    join public.flyers f on f.id = p.flyer_id
    where l.id = layer_id and f.status = 'published'));

-- Form submissions
create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  flyer_id uuid not null references public.flyers(id) on delete cascade,
  layer_id uuid references public.layers(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.form_submissions enable row level security;
create index on public.form_submissions(flyer_id);

create policy "owner reads submissions" on public.form_submissions for select to authenticated
  using (exists (select 1 from public.flyers f where f.id = flyer_id and f.owner_id = auth.uid()));
create policy "anyone can submit to published flyers" on public.form_submissions for insert to anon, authenticated
  with check (exists (select 1 from public.flyers f where f.id = flyer_id and f.status = 'published'));

-- Analytics events
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  flyer_id uuid not null references public.flyers(id) on delete cascade,
  page_id uuid references public.pages(id) on delete set null,
  layer_id uuid references public.layers(id) on delete set null,
  event_type public.event_type not null,
  metadata jsonb not null default '{}'::jsonb,
  session_id text,
  created_at timestamptz not null default now()
);
alter table public.analytics_events enable row level security;
create index on public.analytics_events(flyer_id, created_at desc);

create policy "owner reads analytics" on public.analytics_events for select to authenticated
  using (exists (select 1 from public.flyers f where f.id = flyer_id and f.owner_id = auth.uid()));
create policy "anyone can insert events for published flyers" on public.analytics_events for insert to anon, authenticated
  with check (exists (select 1 from public.flyers f where f.id = flyer_id and f.status = 'published'));

-- Storage bucket for flyer assets
insert into storage.buckets (id, name, public) values ('flyer-assets','flyer-assets', true)
on conflict (id) do nothing;

create policy "public read flyer assets" on storage.objects for select to anon, authenticated
  using (bucket_id = 'flyer-assets');
create policy "auth users upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'flyer-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "auth users update own assets" on storage.objects for update to authenticated
  using (bucket_id = 'flyer-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "auth users delete own assets" on storage.objects for delete to authenticated
  using (bucket_id = 'flyer-assets' and (storage.foldername(name))[1] = auth.uid()::text);

-- Auto-assign 'user' role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
