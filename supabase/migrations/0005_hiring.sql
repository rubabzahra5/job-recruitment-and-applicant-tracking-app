-- ─── 0005_hiring.sql ──────────────────────────────────────────────────────
-- Interviews, offers, and hiring records.

-- ─── interviews ─────────────────────────────────────────────────────────────
create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  timezone text not null default 'Asia/Karachi',
  format text not null check (format in ('in_person', 'video', 'phone')),
  venue text,
  meeting_link text,
  instructions text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'rescheduled', 'cancelled', 'completed', 'no_show')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_interviews_updated_at
  before update on public.interviews
  for each row execute function public.set_updated_at();
create index interviews_application_id_idx on public.interviews (application_id);
create index interviews_org_id_idx on public.interviews (org_id);
create index interviews_scheduled_at_idx on public.interviews (scheduled_at);

-- ─── interview_participants ─────────────────────────────────────────────────
create table public.interview_participants (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text not null,
  role_text text,
  created_at timestamptz not null default now()
);
create index interview_participants_interview_id_idx on public.interview_participants (interview_id);

-- ─── interview_feedback ─────────────────────────────────────────────────────
create table public.interview_feedback (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  reviewer_user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  strengths text,
  concerns text,
  recommendation text not null check (recommendation in ('hire', 'no_hire', 'maybe')),
  submitted_at timestamptz not null default now(),
  unique (interview_id, reviewer_user_id)
);
create index interview_feedback_interview_id_idx on public.interview_feedback (interview_id);

-- ─── offers ─────────────────────────────────────────────────────────────────
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  salary_amount numeric,
  salary_period text check (salary_period in ('monthly', 'annual', 'hourly', 'project')),
  joining_date date,
  expires_at timestamptz,
  status text not null default 'draft'
    check (status in (
      'draft', 'pending_approval', 'sent', 'accepted', 'declined', 'withdrawn', 'expired'
    )),
  terms text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_offers_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at();
create index offers_application_id_idx on public.offers (application_id);
create index offers_org_id_idx on public.offers (org_id);

-- ─── offer_approvals ────────────────────────────────────────────────────────
create table public.offer_approvals (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  approver_user_id uuid not null references public.profiles(id) on delete cascade,
  decision text not null check (decision in ('approved', 'rejected')),
  note text,
  created_at timestamptz not null default now()
);
create index offer_approvals_offer_id_idx on public.offer_approvals (offer_id);

-- ─── hiring_records ─────────────────────────────────────────────────────────
create table public.hiring_records (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  offer_id uuid references public.offers(id) on delete set null,
  hired_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);
