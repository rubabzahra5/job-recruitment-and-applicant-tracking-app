-- ─── 0004_applications.sql ────────────────────────────────────────────────
-- Job applications and the hiring pipeline instance data.
--
-- Stage transitions are validated by BOTH:
--   1. the `validate_application_stage_transition` trigger below (protects
--      direct SQL writes), and
--   2. lib/pipeline.ts (application-level validation in server actions).
-- Allowed transitions live in pipeline_transitions (seeded in 0009_seed.sql).

-- ─── applications ───────────────────────────────────────────────────────────
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid references public.candidate_documents(id) on delete set null,
  cover_letter text,
  stage text not null default 'applied'
    check (stage in (
      'applied', 'initial_screening', 'shortlisted', 'assessment',
      'interview_scheduled', 'interview_completed', 'reference_check',
      'offer_pending', 'offer_accepted', 'offer_declined',
      'hired', 'rejected', 'withdrawn'
    )),
  snapshot_title text,
  snapshot_org_name text,
  submitted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_applications_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();
-- One ACTIVE application per candidate per job. Withdrawing (withdrawn_at set)
-- frees the slot so the candidate may re-apply later.
create unique index applications_user_job_active_uniq
  on public.applications (user_id, job_id)
  where withdrawn_at is null;
create index applications_job_id_idx on public.applications (job_id);
create index applications_org_id_idx on public.applications (org_id);
create index applications_user_id_idx on public.applications (user_id);
create index applications_stage_idx on public.applications (stage);

-- ─── stage transition guard ─────────────────────────────────────────────────
create or replace function public.validate_application_stage_transition()
returns trigger
language plpgsql
as $$
declare
  v_from_id uuid;
  v_to_id uuid;
  v_is_terminal boolean;
begin
  if new.stage = old.stage then
    return new;
  end if;

  select id, is_terminal into v_from_id, v_is_terminal
  from public.pipeline_stages
  where key = old.stage;

  select id into v_to_id
  from public.pipeline_stages
  where key = new.stage;

  if v_from_id is null or v_to_id is null then
    raise exception 'Unknown pipeline stage in transition "%" → "%"', old.stage, new.stage;
  end if;

  if v_is_terminal then
    raise exception 'Cannot transition out of terminal stage "%"', old.stage;
  end if;

  if not exists (
    select 1
    from public.pipeline_transitions
    where from_stage = v_from_id
      and to_stage = v_to_id
  ) then
    raise exception 'Invalid pipeline transition "%" → "%"', old.stage, new.stage;
  end if;

  -- Stamp withdrawals automatically when the stage moves to withdrawn.
  if new.stage = 'withdrawn' and new.withdrawn_at is null then
    new.withdrawn_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_application_stage on public.applications;
create trigger trg_validate_application_stage
  before update of stage on public.applications
  for each row execute function public.validate_application_stage_transition();

-- ─── application_answers ────────────────────────────────────────────────────
create table public.application_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  question_id uuid references public.job_questions(id) on delete set null,
  question_text text not null,
  answer text not null,
  created_at timestamptz not null default now()
);
create index application_answers_application_id_idx on public.application_answers (application_id);

-- ─── application_documents ──────────────────────────────────────────────────
create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);
create index application_documents_application_id_idx on public.application_documents (application_id);

-- ─── application_status_history ─────────────────────────────────────────────
create table public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);
create index application_status_history_application_id_idx on public.application_status_history (application_id);

-- ─── application_assignments ────────────────────────────────────────────────
create table public.application_assignments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  assignee_user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index application_assignments_application_id_idx on public.application_assignments (application_id);

-- ─── application_notes ──────────────────────────────────────────────────────
create table public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  note text not null,
  is_internal boolean not null default true,
  created_at timestamptz not null default now()
);
create index application_notes_application_id_idx on public.application_notes (application_id);

-- ─── candidate_messages ─────────────────────────────────────────────────────
create table public.candidate_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  is_from_candidate boolean not null,
  created_at timestamptz not null default now()
);
create index candidate_messages_application_id_idx on public.candidate_messages (application_id);
