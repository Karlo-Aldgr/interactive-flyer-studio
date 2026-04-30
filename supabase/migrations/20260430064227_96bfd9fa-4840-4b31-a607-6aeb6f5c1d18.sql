-- Public bucket for flyer social/thumbnail images
insert into storage.buckets (id, name, public)
values ('flyer-thumbnails', 'flyer-thumbnails', true)
on conflict (id) do nothing;

-- Public read for everyone (social crawlers + browsers)
create policy "Public read flyer thumbnails"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'flyer-thumbnails');

-- Owner can insert thumbnail. Filename pattern: "{flyer_id}.jpg" or "{flyer_id}-anything"
create policy "Owner can insert flyer thumbnail"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'flyer-thumbnails'
  and exists (
    select 1 from public.flyers f
    where f.owner_id = auth.uid()
      and split_part(split_part(name, '/', -1), '.', 1) = f.id::text
  )
);

create policy "Owner can update flyer thumbnail"
on storage.objects for update
to authenticated
using (
  bucket_id = 'flyer-thumbnails'
  and exists (
    select 1 from public.flyers f
    where f.owner_id = auth.uid()
      and split_part(split_part(name, '/', -1), '.', 1) = f.id::text
  )
);

create policy "Owner can delete flyer thumbnail"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'flyer-thumbnails'
  and exists (
    select 1 from public.flyers f
    where f.owner_id = auth.uid()
      and split_part(split_part(name, '/', -1), '.', 1) = f.id::text
  )
);