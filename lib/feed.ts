import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  FEED_PAGE_SIZE,
  POST_COMMENTS_PREVIEW,
  type FeedAuthorView,
  type FeedCommentView,
  type FeedOriginalPostView,
  type FeedPostView,
} from "@/lib/feed-shared";

/**
 * Community feed data layer (migration 0015: posts / post_likes /
 * post_comments; migration 0016: posts.original_post_id for reposts).
 *
 * FAIL-SOFT CONTRACT: every read returns `{ ready: false }` instead of
 * throwing when the feed tables are unavailable — most importantly before
 * migration 0015 has been run. Pages render a friendly "being set up"
 * state for `ready: false`; no existing page may crash because the feed
 * is not live yet.
 *
 * Migration 0016 has its own, softer fallback: when original_post_id
 * doesn't exist yet, reads fall back to the 0015 select and posts carry
 * `shareEnabled: false`, so share controls hide while the rest of the
 * feed keeps working.
 *
 * Reads use the service-role client (RLS bypassed) AFTER the caller has
 * established the session, mirroring lib/responsiveness.ts. Authorization
 * for writes lives in app/(public)/feed/_actions.ts via lib/rbac.ts; RLS
 * policies in 0015 protect direct API access.
 */

type Db = ReturnType<typeof createAdminClient>;

export type FeedRead<T> = { ready: true; data: T } | { ready: false };

interface RawAuthor {
  id: string;
  display_name: string | null;
  email: string | null;
  profile_public: boolean | null;
}

interface RawPost {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  /** Migration 0016; absent when the pre-0016 select fallback was used. */
  original_post_id?: string | null;
  author: RawAuthor | null;
  org: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    verification_status: string | null;
  } | null;
  job: {
    id: string;
    title: string;
    slug: string;
    employment_type: string;
    workplace: string;
    location_id: string | null;
  } | null;
}

/** Pre-0016 select (migration 0015 shape). */
const POST_SELECT_V1 = `
  id, body, created_at, author_id,
  author:profiles!author_id ( id, display_name, email, profile_public ),
  org:organizations!org_id ( id, name, slug, logo_url, verification_status ),
  job:jobs!job_id ( id, title, slug, employment_type, workplace, location_id )
`;

/** Current select: adds posts.original_post_id (migration 0016, reposts). */
const POST_SELECT = `
  id, body, created_at, author_id, original_post_id,
  author:profiles!author_id ( id, display_name, email, profile_public ),
  org:organizations!org_id ( id, name, slug, logo_url, verification_status ),
  job:jobs!job_id ( id, title, slug, employment_type, workplace, location_id )
`;

/** The original post embedded in a repost (quoted card payload). */
interface RawOriginalPost {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author: RawAuthor | null;
  org: RawPost["org"];
  job: { id: string; title: string; slug: string } | null;
}

const ORIGINAL_SELECT = `
  id, body, created_at, author_id,
  author:profiles!author_id ( id, display_name, email, profile_public ),
  org:organizations!org_id ( id, name, slug, logo_url, verification_status ),
  job:jobs!job_id ( id, title, slug )
`;

type PostQueryResult = { data: unknown; error: unknown };

/**
 * Run a posts query with the 0016 select, falling back to the 0015 select
 * when the column doesn't exist yet. `shareReady` tells callers whether
 * repost data (original_post_id) is available; when it isn't, the feed
 * still renders — share controls just stay hidden (fail-soft for the
 * window between deploying this code and running migration 0016).
 */
async function fetchPostRows(
  runQuery: (select: string) => PromiseLike<PostQueryResult>,
): Promise<{ rows: RawPost[]; shareReady: boolean }> {
  const v2 = await runQuery(POST_SELECT);
  if (!v2.error) {
    return { rows: (v2.data ?? []) as unknown as RawPost[], shareReady: true };
  }
  const v1 = await runQuery(POST_SELECT_V1);
  if (v1.error) throw v1.error;
  return { rows: (v1.data ?? []) as unknown as RawPost[], shareReady: false };
}

function emailPrefix(email: string | null): string {
  return email?.split("@")[0] ?? "Member";
}

/** Build author views for a set of profiles, enriching with candidate data. */
async function buildAuthors(
  db: Db,
  authorsById: Map<string, RawAuthor>,
): Promise<Map<string, FeedAuthorView>> {
  const views = new Map<string, FeedAuthorView>();
  const ids = [...authorsById.keys()];
  if (ids.length === 0) return views;

  const candidateByUser = new Map<string, { full_name: string; headline: string | null }>();
  const { data: candidates } = await db
    .from("candidate_profiles")
    .select("user_id, full_name, headline")
    .in("user_id", ids);
  for (const c of candidates ?? []) {
    candidateByUser.set(c.user_id as string, {
      full_name: c.full_name as string,
      headline: (c.headline as string | null) ?? null,
    });
  }

  for (const [id, raw] of authorsById) {
    const candidate = candidateByUser.get(id);
    views.set(id, {
      id,
      name: candidate?.full_name ?? raw.display_name ?? emailPrefix(raw.email),
      headline: candidate?.headline ?? null,
      isCandidate: Boolean(candidate),
      profilePublic: raw.profile_public === true,
    });
  }
  return views;
}

/** Assemble full post views (likes, comments, job locations) for raw rows. */
async function assemblePosts(
  db: Db,
  rows: RawPost[],
  viewerId: string | null,
  shareReady = false,
): Promise<FeedPostView[]> {
  if (rows.length === 0) return [];
  const postIds = rows.map((r) => r.id);

  // Authors for posts AND comments share one enrichment pass.
  const authorsById = new Map<string, RawAuthor>();
  for (const r of rows) {
    if (r.author) authorsById.set(r.author.id, r.author);
  }

  // ── Reposts (migration 0016): quoted originals + share counts ──────────
  const originalsById = new Map<string, RawOriginalPost>();
  const shareCounts = new Map<string, number>();
  const sharedByMe = new Set<string>();
  if (shareReady) {
    const originalIds = [
      ...new Set(rows.map((r) => r.original_post_id).filter((x): x is string => Boolean(x))),
    ];
    if (originalIds.length > 0) {
      const { data: originalRows, error: originalsError } = await db
        .from("posts")
        .select(ORIGINAL_SELECT)
        .in("id", originalIds);
      if (originalsError) throw originalsError;
      for (const o of (originalRows ?? []) as unknown as RawOriginalPost[]) {
        originalsById.set(o.id, o);
        if (o.author) authorsById.set(o.author.id, o.author);
      }
    }
    const { data: shareRows, error: sharesError } = await db
      .from("posts")
      .select("original_post_id, author_id")
      .in("original_post_id", postIds);
    if (sharesError) throw sharesError;
    for (const s of shareRows ?? []) {
      const oid = s.original_post_id as string;
      shareCounts.set(oid, (shareCounts.get(oid) ?? 0) + 1);
      if (viewerId && (s.author_id as string) === viewerId) sharedByMe.add(oid);
    }
  }

  const { data: commentRows, error: commentsError } = await db
    .from("post_comments")
    .select(
      "id, post_id, body, created_at, author:profiles!author_id ( id, display_name, email, profile_public )",
    )
    .in("post_id", postIds)
    .order("created_at", { ascending: true })
    .limit(postIds.length * POST_COMMENTS_PREVIEW);
  if (commentsError) throw commentsError;

  type RawComment = {
    id: string;
    post_id: string;
    body: string;
    created_at: string;
    author: RawAuthor | null;
  };
  const comments = (commentRows ?? []) as unknown as RawComment[];
  for (const c of comments) {
    if (c.author) authorsById.set(c.author.id, c.author);
  }
  const authorViews = await buildAuthors(db, authorsById);

  const fallbackAuthor = (id: string): FeedAuthorView => ({
    id,
    name: "Member",
    headline: null,
    isCandidate: false,
    profilePublic: false,
  });

  // Likes: counts + whether the viewer liked each post.
  const { data: likeRows, error: likesError } = await db
    .from("post_likes")
    .select("post_id, user_id")
    .in("post_id", postIds);
  if (likesError) throw likesError;
  const likeCounts = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const l of likeRows ?? []) {
    const pid = l.post_id as string;
    likeCounts.set(pid, (likeCounts.get(pid) ?? 0) + 1);
    if (viewerId && (l.user_id as string) === viewerId) likedByMe.add(pid);
  }

  // Job location labels (jobs embed carries only location_id).
  const locationIds = [
    ...new Set(rows.map((r) => r.job?.location_id).filter((x): x is string => Boolean(x))),
  ];
  const locationById = new Map<string, string>();
  if (locationIds.length > 0) {
    const { data: locs } = await db
      .from("locations")
      .select("id, city, province")
      .in("id", locationIds);
    for (const loc of locs ?? []) {
      locationById.set(loc.id as string, `${loc.city as string}, ${loc.province as string}`);
    }
  }

  const commentsByPost = new Map<string, FeedCommentView[]>();
  for (const c of comments) {
    const list = commentsByPost.get(c.post_id) ?? [];
    list.push({
      id: c.id,
      body: c.body,
      createdAt: c.created_at,
      author: (c.author ? authorViews.get(c.author.id) : undefined) ?? fallbackAuthor(""),
    });
    commentsByPost.set(c.post_id, list);
  }

  const buildOriginalView = (o: RawOriginalPost): FeedOriginalPostView => ({
    id: o.id,
    body: o.body,
    createdAt: o.created_at,
    author: (o.author ? authorViews.get(o.author.id) : undefined) ?? fallbackAuthor(o.author_id),
    org: o.org
      ? {
          id: o.org.id,
          name: o.org.name,
          slug: o.org.slug,
          logoUrl: o.org.logo_url,
          verified: o.org.verification_status === "verified",
        }
      : null,
    job: o.job ? { id: o.job.id, title: o.job.title, slug: o.job.slug } : null,
  });

  return rows.map((r) => {
    const postComments = commentsByPost.get(r.id) ?? [];
    // A post is a repost when it points at an original — or when its body
    // is empty, which is only possible for a repost whose original was
    // deleted (ON DELETE SET NULL cleared the pointer; see migration 0016).
    const originalRaw = r.original_post_id ? originalsById.get(r.original_post_id) : undefined;
    const isRepost = shareReady && (r.original_post_id != null || r.body === "");
    return {
      id: r.id,
      body: r.body,
      createdAt: r.created_at,
      author: (r.author ? authorViews.get(r.author.id) : undefined) ?? fallbackAuthor(r.author_id),
      org: r.org
        ? {
            id: r.org.id,
            name: r.org.name,
            slug: r.org.slug,
            logoUrl: r.org.logo_url,
            verified: r.org.verification_status === "verified",
          }
        : null,
      job: r.job
        ? {
            id: r.job.id,
            title: r.job.title,
            slug: r.job.slug,
            employmentType: r.job.employment_type,
            workplace: r.job.workplace,
            locationLabel:
              r.job.workplace === "remote"
                ? "Remote"
                : (r.job.location_id ? locationById.get(r.job.location_id) : undefined) ?? "Pakistan",
          }
        : null,
      likeCount: likeCounts.get(r.id) ?? 0,
      likedByMe: likedByMe.has(r.id),
      commentCount: postComments.length,
      comments: postComments.slice(0, POST_COMMENTS_PREVIEW),
      shareCount: shareCounts.get(r.id) ?? 0,
      sharedByMe: sharedByMe.has(r.id),
      isRepost,
      original: originalRaw ? buildOriginalView(originalRaw) : null,
      originalUnavailable: isRepost && !originalRaw,
      shareEnabled: shareReady,
    };
  });
}

export interface FeedPage {
  posts: FeedPostView[];
  /** created_at cursor for the next page, or null when the feed is exhausted. */
  nextCursor: string | null;
}

/** The main feed: newest first, keyset-paginated by created_at. */
export async function listFeedPosts(
  viewerId: string,
  options: { limit?: number; before?: string | null } = {},
): Promise<FeedRead<FeedPage>> {
  const db = createAdminClient();
  const limit = options.limit ?? FEED_PAGE_SIZE;
  try {
    const { rows, shareReady } = await fetchPostRows(async (select) => {
      let query = db
        .from("posts")
        .select(select)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (options.before) query = query.lt("created_at", options.before);
      const { data, error } = await query;
      return { data, error };
    });
    const posts = await assemblePosts(db, rows, viewerId, shareReady);
    return {
      ready: true,
      data: {
        posts,
        nextCursor: rows.length === limit ? (rows[rows.length - 1]?.created_at ?? null) : null,
      },
    };
  } catch (e) {
    console.error("[feed] listFeedPosts failed (feed not set up yet?):", e);
    return { ready: false };
  }
}

/** Posts published "as" one organization — for the public company page. */
export async function listOrgPosts(
  viewerId: string | null,
  orgId: string,
  limit = FEED_PAGE_SIZE,
): Promise<FeedRead<FeedPostView[]>> {
  const db = createAdminClient();
  try {
    const { rows, shareReady } = await fetchPostRows(async (select) => {
      const { data, error } = await db
        .from("posts")
        .select(select)
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(limit);
      return { data, error };
    });
    const posts = await assemblePosts(db, rows, viewerId, shareReady);
    return { ready: true, data: posts };
  } catch (e) {
    console.error("[feed] listOrgPosts failed (feed not set up yet?):", e);
    return { ready: false };
  }
}

/** A person's own posts — for their public profile page. */
export async function listAuthorPosts(
  viewerId: string | null,
  authorId: string,
  limit = FEED_PAGE_SIZE,
): Promise<FeedRead<FeedPostView[]>> {
  const db = createAdminClient();
  try {
    const { rows, shareReady } = await fetchPostRows(async (select) => {
      const { data, error } = await db
        .from("posts")
        .select(select)
        .eq("author_id", authorId)
        .order("created_at", { ascending: false })
        .limit(limit);
      return { data, error };
    });
    const posts = await assemblePosts(db, rows, viewerId, shareReady);
    return { ready: true, data: posts };
  } catch (e) {
    console.error("[feed] listAuthorPosts failed (feed not set up yet?):", e);
    return { ready: false };
  }
}

/** One post, fully assembled — used right after creating a post. */
export async function getFeedPost(
  viewerId: string,
  postId: string,
): Promise<FeedPostView | null> {
  const db = createAdminClient();
  const { rows, shareReady } = await fetchPostRows(async (select) => {
    const { data, error } = await db
      .from("posts")
      .select(select)
      .eq("id", postId)
      .maybeSingle();
    return { data: data ? [data] : [], error };
  });
  if (rows.length === 0) return null;
  const posts = await assemblePosts(db, rows, viewerId, shareReady);
  return posts[0] ?? null;
}
