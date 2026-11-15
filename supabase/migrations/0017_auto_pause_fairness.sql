-- Auto-pause fairness fix (follow-up to 0012_ghost_job_accountability).
--
-- THE BUG (proven live, November 2026): the 0012 version of
-- auto_pause_stale_jobs() paused a published job when its employer
-- activity stamp was missing OR older than the inactivity window. A
-- missing stamp means "activity was never recorded" — it does NOT mean
-- "inactive since forever". But the app only stamps activity when an
-- employer moves an application between stages, never when a job is
-- published, so brand-new postings (including every seeded job, which
-- was inserted without a stamp) were treated as infinitely stale. The
-- daily cron paused them all and the public job board went empty.
--
-- THE FIX: pause on EFFECTIVE activity —
--   coalesce(last_employer_activity_at, published_at, created_at)
-- A job with no activity stamp is treated as active since the day it
-- was published (or created), and is only paused once THAT date is
-- older than the inactivity window. The app now also stamps
-- last_employer_activity_at when a job is published, so the stamp is
-- present for new postings; this coalesce keeps every pre-existing and
-- directly-inserted row safe regardless.
--
-- Same signature, same return shape as 0012 — callers (cron route,
-- control-center action) are unchanged. Idempotent: create or replace
-- only, no data changes.

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
    and coalesce(j.last_employer_activity_at, j.published_at, j.created_at)
        < now() - (inactivity_days || ' days')::interval
  returning j.id, j.title, o.name;
end;
$$;

comment on function public.auto_pause_stale_jobs(int) is
  'Auto-pauses published jobs whose effective employer activity (last recorded activity, else publish date, else creation date) is older than N days (ghost-job prevention).';

-- ─── SEC-04 (security review 2026-11-15): lock down EXECUTE ──────────
-- This function is SECURITY DEFINER and PostgreSQL grants EXECUTE to
-- PUBLIC by default, which Supabase exposes as an RPC endpoint: anyone
-- holding the public anon key could call it directly — bypassing the
-- cron route's CRON_SECRET check — and, with inactivity_days = 0, pause
-- essentially every published job in one unauthenticated request.
-- The only legitimate callers are the cron route and the control center,
-- and both call through the service role, so execute is revoked from
-- everyone else and granted to service_role only.
revoke execute on function public.auto_pause_stale_jobs(int) from public, anon, authenticated;
grant execute on function public.auto_pause_stale_jobs(int) to service_role;
