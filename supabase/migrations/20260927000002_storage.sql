-- Private bucket for gift card photos. Each user uploads into a folder named after their user id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-images', 'card-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "upload own card images" on storage.objects for insert to authenticated
  with check (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "read own card images or admin" on storage.objects for select to authenticated
  using (bucket_id = 'card-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
