-- Security hardening (Phase 1, item 18 — fixes for the 2026-11-15
-- security review, docs/security/test-report.md; DRAFT-reviewed).
--
-- Contents:
--   SEC-01  rate_limit_hits: enable RLS, revoke API-role grants.
--   SEC-02  organizations: verification_status / account_status become
--           server-controlled (trigger guard).
--   SEC-06  profiles: is_active / phone_verified / phone_verified_at /
--           email become server-controlled (same guard mechanism).
--   SEC-08  audit_logs: drop the any-signed-in-user insert policy.
--   SEC-13  platform_settings: drop the any-signed-in-user select policy.
--
-- Nothing here changes application behaviour for legitimate flows:
-- every app write to the guarded columns goes through the service role
-- (control-center actions via adminContext, lib/audit.ts), and every
-- app read of platform_settings uses the service role too (verified by
-- code audit, 2026-11-15 — see SEC-13 note below).

-- ═══ SEC-01: rate_limit_hits has no Row Level Security ═══════════════
-- Migration 0011 created the table without enabling RLS, so the API
-- roles (anon/authenticated) kept their default table grants: anyone
-- with the public anon key could read the table (leaking IPs/user ids),
-- insert fake hits to lock a victim out, or delete rows to switch off
-- rate limiting platform-wide. The ONLY accessor is lib/rate-limit.ts
-- through the service-role client, which bypasses RLS — so enabling
-- RLS with no policies, plus an explicit revoke, closes the API path
-- without touching server behaviour.
alter table public.rate_limit_hits enable row level security;
revoke all on table public.rate_limit_hits from anon, authenticated;

-- ═══ SEC-02 + SEC-06: trust columns are server-controlled ════════════
-- RLS policies restrict WHICH ROWS a caller can touch, not WHICH
-- COLUMNS. Before this migration, any signed-in user calling the
-- database API directly could:
--   - insert an organization pre-marked verification_status='verified',
--     or set their own suspended/rejected org back to verified/active
--     (organizations_insert is with check (true); the update policy
--     checks only the caller's role);
--   - set their own profiles.is_active back to true after suspension,
--     set phone_verified without an OTP, or rewrite profiles.email
--     (which invitation acceptance compares against).
--
-- The guard below runs BEFORE INSERT/UPDATE and silently keeps trust
-- columns at server-controlled values for non-privileged callers. It
-- never raises, so legitimate updates to other columns are unaffected.
--
-- A caller is PRIVILEGED when any of these holds:
--   1. the API call uses the service-role key (JWT role claim =
--      'service_role') — all control-center / server writes;
--   2. the caller is a super admin (public.is_super_admin());
--   3. the write does not arrive through the API at all
--      (session_user <> 'authenticator'): direct database connections —
--      migrations, the SQL editor, psql — i.e. the operator, who already
--      has full database access and cannot be constrained by a trigger.
--
-- Implementation notes:
--   - The JWT role is read from the request GUCs — the same values
--     auth.role() reads — via current_setting() rather than auth.role()
--     itself, so this function also runs in the project's plain-
--     PostgreSQL migration-validation harness (which stubs auth.uid()
--     but not auth.role()). The GUCs are unaffected by SECURITY
--     DEFINER, so the check sees the real API caller.
--   - The claims parse is wrapped so a malformed value can never make
--     the trigger raise: worst case the caller is treated as
--     non-privileged and the trust columns are kept.
create or replace function public.guard_trust_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claims text;
  v_jwt_role text := '';
  v_privileged boolean := false;
begin
  -- Privilege check (see header). Never raises.
  begin
    v_claims := nullif(current_setting('request.jwt.claims', true), '');
    if v_claims is not null then
      v_jwt_role := coalesce(v_claims::jsonb ->> 'role', '');
    end if;
    if v_jwt_role = '' then
      v_jwt_role := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '');
    end if;
  exception when others then
    v_jwt_role := '';
  end;

  v_privileged :=
    v_jwt_role = 'service_role'
    or session_user <> 'authenticator'
    or public.is_super_admin();

  if v_privileged then
    return new;
  end if;

  if tg_table_name = 'organizations' then
    if tg_op = 'INSERT' then
      -- Self-service signups always start from the safe defaults,
      -- whatever the caller tried to supply.
      new.verification_status := 'unverified';
      new.account_status := 'active';
    elsif tg_op = 'UPDATE' then
      new.verification_status := old.verification_status;
      new.account_status := old.account_status;
    end if;
  elsif tg_table_name = 'profiles' then
    -- Attached for UPDATE only. Name/avatar/headline etc. stay editable;
    -- only the four admin-controlled columns are pinned to their old
    -- values. (profiles.email follows the auth account's email through
    -- the server-side settings flow, which writes via the service role.)
    new.is_active := old.is_active;
    new.phone_verified := old.phone_verified;
    new.phone_verified_at := old.phone_verified_at;
    new.email := old.email;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_organizations_trust_columns on public.organizations;
create trigger guard_organizations_trust_columns
  before insert or update on public.organizations
  for each row execute function public.guard_trust_columns();

drop trigger if exists guard_profiles_trust_columns on public.profiles;
create trigger guard_profiles_trust_columns
  before update on public.profiles
  for each row execute function public.guard_trust_columns();

-- ═══ SEC-08: anyone signed in can forge audit-log entries ════════════
-- 0007 added audit_logs_insert (with check (true)) "so request-scoped
-- clients can log too", but the app's only writer, lib/audit.ts
-- (writeAudit), uses the service-role client, which bypasses RLS — no
-- application code path needs this policy. Dropping it keeps the audit
-- trail append-only AND server-written only.
drop policy if exists audit_logs_insert on public.audit_logs;

-- ═══ SEC-13: platform settings readable by every signed-in user ══════
-- 0007's platform_settings_select uses (true): any free account could
-- read the platform's operating configuration (which moderation gates
-- are on) — reconnaissance for abuse, and a future footgun if anything
-- sensitive is ever stored there. Code audit (2026-11-15): EVERY app
-- read of platform_settings goes through the service role —
--   app/(employer)/_lib/org.ts getPlatformSetting (createAdminClient),
--   app/(admin)/control-center/** (adminContext),
--   app/api/cron/auto-pause/route.ts (createAdminClient)
-- — so no key whitelist is needed: drop the public select policy and
-- leave platform_settings_superadmin (is_super_admin) as the only
-- user-client path. Secrets still never belong in this table; they live
-- in environment variables only.
drop policy if exists platform_settings_select on public.platform_settings;
