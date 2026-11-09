-- ─── 0015_feed.sql ────────────────────────────────────────────────────────
-- Community feed (LinkedIn-style) + opt-in public candidate profiles.
--
-- Adds:
--   profiles.profile_public  — a candidate's public profile page (/people/[id])
--                              is visible ONLY when they switch this on.
--                              Defaults to false (private by default).
--   posts                    — feed posts by a person, optionally "as" their
--                              organization (org_id) and optionally sharing a
--                              published job (job_id).
--   post_likes               — one like per (post, user).
--   post_comments            — comments on posts.
--
-- RLS follows the 0007_rls.sql style: a super_admin FOR ALL policy (which
-- doubles as moderation — admins can delete any post/comment), narrow
-- role policies, and the SECURITY DEFINER helpers from 0001 (is_super_admin(),
-- user_org_role()) so policies never recurse into user_roles.
-- The service_role key bypasses RLS; server actions in
-- app/(public)/feed/_actions.ts additionally authorize via lib/rbac.ts.

-- ─── profiles: opt-in public profile ────────────────────────────────────────
alter table public.profiles
  add column if not exists profile_public boolean not null default false;

comment on column public.profiles.profile_public is
  'Opt-in: when true, the candidate''s public profile page (/people/[id]) is visible to anyone. Default false (private).';

-- ─── posts ──────────────────────────────────────────────────────────────────
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_posts_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();
create index posts_created_at_idx on public.posts (created_at desc);
create index posts_org_id_idx on public.posts (org_id);
create index posts_author_id_idx on public.posts (author_id);

-- ─── post_likes ─────────────────────────────────────────────────────────────
create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_likes_user_id_idx on public.post_likes (user_id);

-- ─── post_comments ──────────────────────────────────────────────────────────
create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index post_comments_post_id_idx on public.post_comments (post_id, created_at);

-- ════════════════════════════ RLS: posts ════════════════════════════════════

alter table public.posts enable row level security;
create policy posts_superadmin on public.posts
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
-- The feed is a logged-in community space: any signed-in user may read it.
create policy posts_select on public.posts
  for select to authenticated using (true);
-- Post as yourself; post "as" an organization only when you hold a role in
-- it (user_org_role() requires an active membership + role grant).
create policy posts_insert on public.posts
  for insert to authenticated with check (
    author_id = auth.uid()
    and (org_id is null or public.user_org_role(org_id) is not null)
  );
create policy posts_update_own on public.posts
  for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy posts_delete_own on public.posts
  for delete to authenticated using (author_id = auth.uid());

-- ════════════════════════════ RLS: post_likes ═══════════════════════════════

alter table public.post_likes enable row level security;
create policy post_likes_superadmin on public.post_likes
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy post_likes_select on public.post_likes
  for select to authenticated using (true);
create policy post_likes_insert_own on public.post_likes
  for insert to authenticated with check (user_id = auth.uid());
create policy post_likes_delete_own on public.post_likes
  for delete to authenticated using (user_id = auth.uid());

-- ════════════════════════════ RLS: post_comments ════════════════════════════

alter table public.post_comments enable row level security;
create policy post_comments_superadmin on public.post_comments
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy post_comments_select on public.post_comments
  for select to authenticated using (true);
create policy post_comments_insert_own on public.post_comments
  for insert to authenticated with check (author_id = auth.uid());
create policy post_comments_update_own on public.post_comments
  for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy post_comments_delete_own on public.post_comments
  for delete to authenticated using (author_id = auth.uid());
