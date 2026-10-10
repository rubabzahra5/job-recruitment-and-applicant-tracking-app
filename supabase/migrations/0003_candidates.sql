-- ─── 0003_candidates.sql ──────────────────────────────────────────────────
-- Candidate profiles and related data.
--
-- PRIVACY: candidate data is private by default (is_searchable defaults to
-- false). RLS (0007_rls.sql) lets candidates manage their own rows and lets
-- org staff view a candidate's data ONLY when that candidate has an
-- application with the staff member's org (or opted into searchability).

-- ─── candidate_profiles ─────────────────────────────────────────────────────
create table public.candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  full_name text not null,
  headline text,
  phone text,
  city text,
  province text,
  expected_salary numeric,
  notice_period_days integer,
  availability text,
  summary text,
  portfolio_links jsonb not null default '[]'::jsonb,
  is_searchable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_candidate_profiles_updated_at
  before update on public.candidate_profiles
  for each row execute function public.set_updated_at();
create index candidate_profiles_user_id_idx on public.candidate_profiles (user_id);

-- ─── candidate_education ────────────────────────────────────────────────────
create table public.candidate_education (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.candidate_profiles(id) on delete cascade,
  institution text not null,
  degree text not null,
  field text,
  start_year integer,
  end_year integer,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);
create index candidate_education_profile_id_idx on public.candidate_education (profile_id);

-- ─── candidate_experience ───────────────────────────────────────────────────
create table public.candidate_experience (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.candidate_profiles(id) on delete cascade,
  employer text not null,
  title text not null,
  start_date date not null,
  end_date date,
  is_current boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index candidate_experience_profile_id_idx on public.candidate_experience (profile_id);

-- ─── candidate_skills ───────────────────────────────────────────────────────
create table public.candidate_skills (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.candidate_profiles(id) on delete cascade,
  skill text not null,
  years numeric,
  created_at timestamptz not null default now()
);
create index candidate_skills_profile_id_idx on public.candidate_skills (profile_id);

-- ─── candidate_certifications ───────────────────────────────────────────────
create table public.candidate_certifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.candidate_profiles(id) on delete cascade,
  name text not null,
  issuer text,
  issued_date date,
  credential_url text,
  created_at timestamptz not null default now()
);
create index candidate_certifications_profile_id_idx on public.candidate_certifications (profile_id);

-- ─── candidate_documents ────────────────────────────────────────────────────
create table public.candidate_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.candidate_profiles(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  kind text not null check (kind in ('cv', 'cover_letter', 'other')),
  is_current_cv boolean not null default false,
  created_at timestamptz not null default now()
);
create index candidate_documents_profile_id_idx on public.candidate_documents (profile_id);

-- ─── saved_jobs ─────────────────────────────────────────────────────────────
create table public.saved_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);
create index saved_jobs_user_id_idx on public.saved_jobs (user_id);

-- ─── job_alerts ─────────────────────────────────────────────────────────────
create table public.job_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_job_alerts_updated_at
  before update on public.job_alerts
  for each row execute function public.set_updated_at();
create index job_alerts_user_id_idx on public.job_alerts (user_id);
