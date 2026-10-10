-- ─── 0001_identity.sql ────────────────────────────────────────────────────
-- Identity, organizations, and audit tables.
-- All timestamps are timestamptz (stored in UTC; display converts to Asia/Karachi).

create extension if not exists "pgcrypto";

-- Generic updated_at trigger: attach per table with
--   create trigger set_<table>_updated_at before update on <table>
--   for each row execute function public.set_updated_at();
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── SECURITY DEFINER helpers ────────────────────────────────────────────────
-- RLS policies MUST use these instead of querying user_roles directly, otherwise
-- policies on user_roles would recurse infinitely. service_role bypasses RLS
-- entirely (Supabase default), so server-side code uses lib/rbac.ts instead.
-- (Defined AFTER the tables: SQL-language function bodies are validated at
-- CREATE time, so the referenced tables must exist first.)

-- ─── profiles ───────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── organizations ──────────────────────────────────────────────────────────
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  cover_url text,
  about text,
  industry text,
  website text,
  contact_email text,
  contact_phone text,
  size_range text,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  account_status text not null default 'active'
    check (account_status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();
create index organizations_slug_idx on public.organizations (slug);

-- ─── departments ────────────────────────────────────────────────────────────
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, name)
);
create trigger set_departments_updated_at
  before update on public.departments
  for each row execute function public.set_updated_at();
create index departments_org_id_idx on public.departments (org_id);

-- ─── organization_memberships ───────────────────────────────────────────────
create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  title text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create trigger set_organization_memberships_updated_at
  before update on public.organization_memberships
  for each row execute function public.set_updated_at();
create index organization_memberships_org_id_idx on public.organization_memberships (org_id);
create index organization_memberships_user_id_idx on public.organization_memberships (user_id);

-- ─── user_roles ─────────────────────────────────────────────────────────────
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  role text not null check (role in (
    'super_admin', 'org_admin', 'hr_manager', 'recruiter',
    'hiring_manager', 'employee', 'candidate'
  )),
  created_at timestamptz not null default now()
);
-- One grant per (user, role, org); org_id NULL (platform-wide grants) is
-- handled with coalesce so NULLs don't slip through a plain unique constraint.
create unique index user_roles_user_role_org_uniq
  on public.user_roles (user_id, role, (coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid)));
create index user_roles_user_id_idx on public.user_roles (user_id);
create index user_roles_org_id_idx on public.user_roles (org_id);

-- ─── organization_invitations ───────────────────────────────────────────────
create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in (
    'org_admin', 'hr_manager', 'recruiter', 'hiring_manager', 'employee'
  )),
  department_id uuid references public.departments(id) on delete set null,
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  created_at timestamptz not null default now()
);
create index organization_invitations_org_id_idx on public.organization_invitations (org_id);
create index organization_invitations_email_idx on public.organization_invitations (email);

-- ─── audit_logs (INSERT-only) ───────────────────────────────────────────────
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  org_id uuid references public.organizations(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_actor_idx on public.audit_logs (actor_user_id);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_org_idx on public.audit_logs (org_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- ─── SECURITY DEFINER helpers (after tables: see note above) ────────────────

-- True when the caller holds a platform-wide super_admin grant.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'super_admin'
      and org_id is null
  );
$$;

-- The caller's effective role in an org (highest privilege wins), or null.
-- Requires BOTH a user_roles grant AND an active organization_memberships row.
create or replace function public.user_org_role(p_org_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select ur.role
  from public.user_roles ur
  join public.organization_memberships om
    on om.user_id = ur.user_id
   and om.org_id = ur.org_id
  where ur.user_id = auth.uid()
    and ur.org_id = p_org_id
    and om.is_active
  order by
    case ur.role
      when 'org_admin' then 1
      when 'hr_manager' then 2
      when 'recruiter' then 3
      when 'hiring_manager' then 4
      when 'employee' then 5
      else 6
    end
  limit 1;
$$;

-- True when the caller holds any of the given roles in the org.
create or replace function public.user_has_org_role(p_org_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_org_role(p_org_id) = any (p_roles);
$$;
