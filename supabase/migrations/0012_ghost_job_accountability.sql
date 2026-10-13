-- Ghost-job accountability foundation (H2).
-- Tracks employer responsiveness so candidates can see which employers
-- actually engage with applications, and so stale postings can be auto-paused.

-- Track last employer activity per job (stage change, interview scheduled, etc.)
alter table public.jobs
  add column if not exists last_employer_activity_at timestamptz;

-- Backfill: use the latest application stage-change as a proxy.
-- (Precise tracking starts from this migration forward via triggers/app code.)
update public.jobs j
set last_employer_activity_at = (
  select max(a.updated_at)
  from public.applications a
  where a.job_id = j.id
    and a.stage <> 'applied'
)
where j.last_employer_activity_at is null;

-- Index for the auto-pause query (jobs with no recent employer activity).
create index if not exists jobs_last_employer_activity_idx
  on public.jobs (last_employer_activity_at)
  where status = 'published';

-- Employer response stats (materialized on demand; simple version).
-- response_rate = % of applications that moved beyond 'applied' stage.
-- Computed by app code; this comment documents the formula:
--   response_rate = COUNT(stage <> 'applied') / COUNT(*)  (per org, last 90 days)

-- Function to auto-pause stale jobs (no employer activity in N days).
-- Called by cron or manually by platform admins.
create or replace function public.auto_pause_stale_jobs(inactivity_days int default 30)
returns table (job_id uuid, job_title text, org_name text)
language plpgsql
security definer
as $$
begin
  return query
  update public.jobs j
  set status = 'paused',
      updated_at = now()
  from public.organizations o
  where j.org_id = o.id
    and j.status = 'published'
    and (
      j.last_employer_activity_at is null
      or j.last_employer_activity_at < now() - (inactivity_days || ' days')::interval
    )
  returning j.id, j.title, o.name;
end;
$$;

comment on function public.auto_pause_stale_jobs(int) is
  'Auto-pauses published jobs with no employer activity in N days (ghost-job prevention).';
