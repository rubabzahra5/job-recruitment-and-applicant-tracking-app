-- ─── 0019_scam_reports.sql ───────────────────────────────────────────────
-- Scam reports (Phase 1, item 8 — trust & safety).
--
-- Adds:
--   scam_reports — reports of suspected scam jobs submitted by anyone
--                  (no account needed) via the public /report-scam page.
--
-- Access design (deliberately the narrowest in the schema):
--   - RLS is ENABLED and there are NO policies for anon or authenticated:
--     the public API cannot read or write this table at all. Reporter
--     emails and descriptions are visible only to the platform team.
--   - INSERTs happen ONLY through the server action in
--     app/(public)/report-scam/actions.ts, which validates with Zod and
--     rate-limits (bucket "scam_report", 5/hour/IP) BEFORE inserting with
--     the service-role client (which bypasses RLS).
--   - READs happen ONLY in the control center
--     (app/(admin)/control-center/scam-reports), which authorizes a fresh
--     super_admin check (adminPageGuard) before using the service role.
--   - As belt-and-braces (the SEC-01 lesson from migration 0018), the
--     default API-role grants are revoked explicitly as well.
--
-- The reporter's IP is never stored raw: the action stores a SHA-256
-- hash in ip_hash so repeat-abuse can be recognised without keeping a
-- directly identifying address.
--
-- Fail-soft: the /report-scam page and the control-center list both
-- render a friendly "being set up" state until this migration has run.

create table if not exists public.scam_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reporter_name text,
  reporter_email text,
  job_id uuid references public.jobs(id) on delete set null,
  job_url text,
  organization_name text,
  scam_type text not null check (
    scam_type in ('money_asked', 'fake_job', 'impersonation', 'phishing', 'other')
  ),
  description text not null,
  evidence_urls text,
  status text not null default 'new' check (
    status in ('new', 'reviewing', 'action_taken', 'dismissed')
  ),
  ip_hash text
);

create index if not exists scam_reports_created_at_idx
  on public.scam_reports (created_at desc);
create index if not exists scam_reports_status_idx
  on public.scam_reports (status);

comment on table public.scam_reports is
  'Public scam-job reports (migration 0019). No anon/authenticated access: writes via the /report-scam server action (service role, validated + rate-limited); reads via the control center only.';

alter table public.scam_reports enable row level security;

-- No policies are created on purpose: with RLS on and zero policies,
-- anon/authenticated get nothing. Revoke the default grants too, so the
-- table does not depend on project-level default-privilege settings.
revoke all on table public.scam_reports from anon, authenticated;
