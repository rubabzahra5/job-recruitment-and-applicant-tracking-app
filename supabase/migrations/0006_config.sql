-- ─── 0006_config.sql ──────────────────────────────────────────────────────
-- Platform configuration: pipeline definition, notifications, email templates,
-- settings, consent and privacy requests.

-- ─── pipeline_stages ────────────────────────────────────────────────────────
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  sort_order integer not null,
  is_terminal boolean not null default false
);

-- ─── pipeline_transitions ───────────────────────────────────────────────────
create table public.pipeline_transitions (
  id uuid primary key default gen_random_uuid(),
  from_stage uuid not null references public.pipeline_stages(id) on delete cascade,
  to_stage uuid not null references public.pipeline_stages(id) on delete cascade,
  unique (from_stage, to_stage),
  check (from_stage <> to_stage)
);

-- ─── notifications ──────────────────────────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_id_idx on public.notifications (user_id);
create index notifications_user_read_idx on public.notifications (user_id, is_read);

-- ─── notification_preferences ───────────────────────────────────────────────
create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- ─── notification_delivery_logs ─────────────────────────────────────────────
create table public.notification_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications(id) on delete set null,
  channel text not null check (channel in ('in_app', 'email', 'sms')),
  status text not null check (status in ('queued', 'sent', 'failed', 'skipped')),
  provider_response text,
  attempted_at timestamptz not null default now()
);
create index notification_delivery_logs_notification_id_idx
  on public.notification_delivery_logs (notification_id);

-- ─── email_templates ────────────────────────────────────────────────────────
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_email_templates_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

-- ─── platform_settings ──────────────────────────────────────────────────────
create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ─── organization_settings ──────────────────────────────────────────────────
create table public.organization_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_organization_settings_updated_at
  before update on public.organization_settings
  for each row execute function public.set_updated_at();

-- ─── consent_records ────────────────────────────────────────────────────────
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null,
  granted boolean not null,
  granted_at timestamptz not null default now(),
  source text
);
create index consent_records_user_id_idx on public.consent_records (user_id);

-- ─── privacy_requests ───────────────────────────────────────────────────────
create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('export', 'deletion', 'correction')),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'rejected')),
  detail text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index privacy_requests_user_id_idx on public.privacy_requests (user_id);
