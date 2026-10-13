-- Candidate verification framework (M2).
-- Adds phone verification fields to profiles. The actual OTP sending requires
-- a paid SMS gateway (not in free-tier scope); this migration lays the
-- database foundation so verification can be enabled later without schema changes.

alter table public.profiles
  add column if not exists phone text,
  add column if not exists phone_verified boolean not null default false,
  add column if not exists phone_verified_at timestamptz;

-- Index for finding unverified phones (admin review).
create index if not exists profiles_phone_verified_idx
  on public.profiles (phone_verified)
  where phone_verified = false;

comment on column public.profiles.phone_verified is
  'True when the candidate completed phone OTP verification. OTP sending requires a paid SMS gateway (future).';
