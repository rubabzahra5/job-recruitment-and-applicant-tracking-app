-- Rate limiting storage (H1 security fix).
-- Tracks action attempts per key (IP, user, etc.) for abuse prevention.
-- No RLS policies: only accessed via service_role from server code.

create table if not exists public.rate_limit_hits (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,           -- e.g. 'login', 'apply', 'invite'
  key text not null,              -- e.g. IP address, user_id, org_id
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_bucket_key_time_idx
  on public.rate_limit_hits (bucket, key, created_at desc);

-- Auto-cleanup: delete hits older than 1 day (keeps table small).
-- Run via cron or periodically; safe to run manually.
create or replace function public.cleanup_rate_limit_hits()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.rate_limit_hits where created_at < now() - interval '1 day';
end;
$$;
