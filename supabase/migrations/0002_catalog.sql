-- ─── 0002_catalog.sql ─────────────────────────────────────────────────────
-- Job catalog: categories, locations, jobs and related tables.

-- ─── job_categories ─────────────────────────────────────────────────────────
create table public.job_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text,
  created_at timestamptz not null default now()
);

-- ─── locations ──────────────────────────────────────────────────────────────
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  province text not null check (province in (
    'Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan',
    'Islamabad Capital Territory', 'Gilgit-Baltistan', 'Azad Jammu and Kashmir'
  )),
  country text not null default 'Pakistan',
  created_at timestamptz not null default now(),
  unique (city, province)
);

-- ─── jobs ───────────────────────────────────────────────────────────────────
-- array_to_string is STABLE, so it cannot appear in a GENERATED column.
-- This thin wrapper is safe to mark IMMUTABLE for our use (pure function of
-- its inputs) and lets the tsvector include the skills array.
create or replace function public.immutable_array_to_string(arr text[], delim text)
returns text
language sql
immutable
strict
as $$
  select array_to_string(arr, delim);
$$;

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  category_id uuid references public.job_categories(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  title text not null,
  slug text not null unique,
  description text not null,
  responsibilities text,
  qualifications text,
  skills text[] not null default '{}',
  experience_min_years numeric,
  experience_max_years numeric,
  education_level text,
  employment_type text not null
    check (employment_type in (
      'full_time', 'part_time', 'contract', 'temporary',
      'internship', 'apprenticeship', 'freelance'
    )),
  workplace text not null
    check (workplace in ('on_site', 'hybrid', 'remote')),
  salary_min numeric,
  salary_max numeric,
  salary_period text not null default 'monthly'
    check (salary_period in ('monthly', 'annual', 'hourly', 'project')),
  salary_disclosed boolean not null default false,
  currency text not null default 'PKR',
  openings integer not null default 1 check (openings >= 1),
  is_fresh_graduate_ok boolean not null default false,
  deadline timestamptz,
  published_at timestamptz,
  status text not null default 'draft'
    check (status in (
      'draft', 'pending_review', 'approved', 'published',
      'paused', 'closed', 'rejected', 'archived'
    )),
  search tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(public.immutable_array_to_string(skills, ' '), '')
    )
  ) stored,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (salary_max is null or salary_min is null or salary_max >= salary_min),
  check (experience_max_years is null or experience_min_years is null
         or experience_max_years >= experience_min_years)
);
create trigger set_jobs_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();
create index jobs_org_id_idx on public.jobs (org_id);
create index jobs_status_idx on public.jobs (status);
create index jobs_category_id_idx on public.jobs (category_id);
create index jobs_location_id_idx on public.jobs (location_id);
create index jobs_deadline_idx on public.jobs (deadline);
create index jobs_search_gin on public.jobs using gin (search);

-- ─── job_questions ──────────────────────────────────────────────────────────
create table public.job_questions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  question text not null,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index job_questions_job_id_idx on public.job_questions (job_id);

-- ─── job_skills ─────────────────────────────────────────────────────────────
create table public.job_skills (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  skill text not null,
  created_at timestamptz not null default now()
);
create index job_skills_job_id_idx on public.job_skills (job_id);

-- ─── job_approvals ──────────────────────────────────────────────────────────
create table public.job_approvals (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  decided_by uuid references public.profiles(id) on delete set null,
  decision text not null check (decision in ('approved', 'rejected')),
  note text,
  created_at timestamptz not null default now()
);
create index job_approvals_job_id_idx on public.job_approvals (job_id);
