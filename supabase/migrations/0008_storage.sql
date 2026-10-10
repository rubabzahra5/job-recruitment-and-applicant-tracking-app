-- ─── 0008_storage.sql ─────────────────────────────────────────────────────
-- Storage buckets and access policies.
--
-- Path convention: {bucket}/{owner_user_id}/{uuid}.{ext}
--   e.g. cvs/3fa85f64-.../9b2d... .pdf
-- Object names are randomized (see lib/uploads.ts randomObjectPath) so object
-- URLs cannot be enumerated.
--
-- CV access model: the storage policy grants read/insert/update/delete ONLY
-- to the owning candidate (auth.uid() = first folder segment). Organization
-- staff NEVER get direct storage access to candidates' CVs — server code
-- generates short-lived SIGNED URLS with the service-role client after
-- checking authorization via lib/rbac.ts + can_view_candidate().

insert into storage.buckets (id, name, public)
values
  ('cvs', 'cvs', false),
  ('offer-docs', 'offer-docs', false),
  ('avatars', 'avatars', false),
  ('org-logos', 'org-logos', true)
on conflict (id) do nothing;

-- ─── cvs (private): owner-only ───────────────────────────────────────────────
create policy cvs_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cvs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy cvs_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cvs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy cvs_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cvs'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'cvs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy cvs_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cvs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ─── offer-docs (private): service-role only ─────────────────────────────────
-- Offer letters and attachments are uploaded/read server-side via signed URLs.
-- No direct anon/authenticated storage policies: least privilege.

-- ─── avatars (private): owner-only ──────────────────────────────────────────
create policy avatars_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy avatars_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy avatars_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy avatars_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ─── org-logos (public read) ────────────────────────────────────────────────
create policy org_logos_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'org-logos');
-- Only org_admins may manage their own org's logo folder: org-logos/{org_id}/…
create policy org_logos_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'org-logos'
    and public.user_org_role(((storage.foldername(name))[1])::uuid) = 'org_admin'
  );
create policy org_logos_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'org-logos'
    and public.user_org_role(((storage.foldername(name))[1])::uuid) = 'org_admin'
  )
  with check (
    bucket_id = 'org-logos'
    and public.user_org_role(((storage.foldername(name))[1])::uuid) = 'org_admin'
  );
create policy org_logos_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'org-logos'
    and public.user_org_role(((storage.foldername(name))[1])::uuid) = 'org_admin'
  );
