-- Photos des capsules temporelles : espace de stockage privé, un dossier par utilisatrice.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('capsules', 'capsules', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "capsules_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'capsules' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "capsules_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'capsules' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "capsules_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'capsules' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'capsules' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "capsules_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'capsules' and (storage.foldername(name))[1] = (select auth.uid())::text);
