-- ─── 0016_share_follow.sql ────────────────────────────────────────────────
-- Community feed, round two: share/repost + follow (LinkedIn-style).
--
-- Adds:
--   posts.original_post_id — when set, the post is a REPOST of another post.
--                            The original renders embedded as a quoted card.
--                            ON DELETE SET NULL: deleting the original leaves
--                            the repost behind with an empty body, which the
--                            app renders as "no longer available".
--   posts body rule        — relaxed: a body may be EMPTY only for a pure
--                            repost (original_post_id is set). Normal posts
--                            still need 1–2000 characters.
--   follows                — follower_id follows a person (follow_profile_id)
--                            XOR a company (follow_org_id).
--
-- RLS follows the 0007_rls.sql / 0015_feed.sql style: a super_admin FOR ALL
-- policy, narrow role policies, and the SECURITY DEFINER helpers from 0001.
-- The service_role key bypasses RLS; server actions in
-- app/(public)/feed/_actions.ts additionally authorize via lib/rbac.ts.
-- App code fails soft until this migration has run (see lib/feed.ts and
-- lib/follows.ts): share/follow UI simply stays hidden.

-- ─── posts: repost support ──────────────────────────────────────────────────
alter table public.posts
  add column if not exists original_post_id uuid
    references public.posts(id) on delete set null;

create index if not exists posts_original_post_id_idx
  on public.posts (original_post_id);

-- Relax the 0015 body check: length ≤ 2000 AND (length ≥ 1 OR it is a repost).
alter table public.posts drop constraint if exists posts_body_check;
alter table public.posts
  add constraint posts_body_check check (
    char_length(body) <= 2000
    and (char_length(body) >= 1 or original_post_id is not null)
  );

comment on column public.posts.original_post_id is
  'When set, this post is a repost (share) of the referenced post. The repost body is the sharer''s own comment and may be empty for a pure repost.';

-- ─── follows ────────────────────────────────────────────────────────────────
create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  follow_profile_id uuid references public.profiles(id) on delete cascade,
  follow_org_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Exactly one target: a person XOR a company.
  constraint follows_exactly_one_target check (
    (follow_profile_id is not null and follow_org_id is null)
    or (follow_profile_id is null and follow_org_id is not null)
  ),
  -- Nobody follows themselves (companies are followed via their page;
  -- org members following their own org is blocked in the app layer).
  constraint follows_no_self_follow check (
    follow_profile_id is null or follow_profile_id <> follower_id
  )
);
-- One follow per (follower, target); partial so person and company follows
-- don't collide on the NULL side.
create unique index follows_follower_profile_uniq
  on public.follows (follower_id, follow_profile_id)
  where follow_profile_id is not null;
create unique index follows_follower_org_uniq
  on public.follows (follower_id, follow_org_id)
  where follow_org_id is not null;
create index follows_follower_id_idx on public.follows (follower_id);
create index follows_profile_id_idx on public.follows (follow_profile_id);
create index follows_org_id_idx on public.follows (follow_org_id);

-- ════════════════════════════ RLS: follows ══════════════════════════════════

alter table public.follows enable row level security;
create policy follows_superadmin on public.follows
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
-- Follow relationships are community data: any signed-in user may read them
-- (follower/following counts are shown on public profile and company pages).
create policy follows_select on public.follows
  for select to authenticated using (true);
-- You can only follow as yourself, and only unfollow your own follows.
create policy follows_insert_own on public.follows
  for insert to authenticated with check (follower_id = auth.uid());
create policy follows_delete_own on public.follows
  for delete to authenticated using (follower_id = auth.uid());
