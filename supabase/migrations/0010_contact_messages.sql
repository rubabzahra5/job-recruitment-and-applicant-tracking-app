-- ─── 0010_contact_messages.sql ──────────────────────────────────────────────
-- Public "Contact us" form submissions. Anonymous visitors may INSERT only;
-- super admins get full access. Notifications to super admins are created
-- server-side (see app/(public)/contact/actions.ts) via lib/notifications.ts.

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  created_at timestamptz not null default now(),
  is_read boolean not null default false
);
create index contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;

-- Public contact form: anyone (anonymous or signed in) may submit, nothing else.
create policy contact_messages_insert_public on public.contact_messages
  for insert to anon, authenticated with check (true);

-- Super admins: full access (read, triage, delete).
create policy contact_messages_superadmin on public.contact_messages
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
