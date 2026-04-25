
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end; $$;

-- Replace public select with: owner-listing only. Public access to assets goes via signed/public URLs which bypass select policy for known paths through the public bucket CDN.
drop policy if exists "public read flyer assets" on storage.objects;
create policy "owner can list own flyer assets" on storage.objects for select to authenticated
  using (bucket_id = 'flyer-assets' and (storage.foldername(name))[1] = auth.uid()::text);
