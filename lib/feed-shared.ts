/**
 * Community feed — shared types and pure helpers.
 *
 * Plain TS (no "server-only", no Supabase imports): used by the server data
 * layer (lib/feed.ts), server actions, client components and unit tests.
 * The feed itself lives in the posts / post_likes / post_comments tables
 * (migration 0015), extended with reposts + follows in migration 0016,
 * and the /feed route in app/(public)/feed.
 */

export const FEED_PAGE_SIZE = 10;
export const POST_BODY_MAX = 2000;
export const COMMENT_BODY_MAX = 500;
/** Comments embedded with each post payload (older ones stay in the DB). */
export const POST_COMMENTS_PREVIEW = 100;

/** The person behind a post or comment, as rendered in the feed. */
export interface FeedAuthorView {
  /** profiles.id of the author. */
  id: string;
  /** Candidate full name when known, else the account display name. */
  name: string;
  headline: string | null;
  /** True when the author has a candidate profile. */
  isCandidate: boolean;
  /** True when profiles.profile_public is on (public page at /people/[id]). */
  profilePublic: boolean;
}

export interface FeedOrgView {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  verified: boolean;
}

export interface FeedJobView {
  id: string;
  title: string;
  slug: string;
  employmentType: string;
  workplace: string;
  locationLabel: string;
}

export interface FeedCommentView {
  id: string;
  body: string;
  createdAt: string;
  author: FeedAuthorView;
}

/** The original post embedded inside a repost, rendered as a quoted card. */
export interface FeedOriginalPostView {
  id: string;
  body: string;
  createdAt: string;
  author: FeedAuthorView;
  /** Set when the original was published "as" a company. */
  org: FeedOrgView | null;
  /** Set when the original shares a published job. */
  job: { id: string; title: string; slug: string } | null;
}

export interface FeedPostView {
  id: string;
  body: string;
  createdAt: string;
  author: FeedAuthorView;
  /** Set when the post was published "as" the author's company. */
  org: FeedOrgView | null;
  /** Set when the post shares a published job. */
  job: FeedJobView | null;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  comments: FeedCommentView[];
  /** Number of times this post has been reposted (shared). */
  shareCount: number;
  /** True when the viewer has already reposted this post. */
  sharedByMe: boolean;
  /** True when this post is itself a repost of another post. */
  isRepost: boolean;
  /** The quoted original (null for normal posts and orphaned reposts). */
  original: FeedOriginalPostView | null;
  /**
   * True for a repost whose original was deleted (or can no longer be
   * loaded) — renders "This shared post is no longer available."
   */
  originalUnavailable: boolean;
  /**
   * True when the share/repost + follow schema (migration 0016) is live.
   * When false the UI hides share controls (fail-soft, pre-migration).
   */
  shareEnabled: boolean;
}

/**
 * Where a person's name should link in the feed.
 *
 * Privacy rule: a candidate's name links to their public profile page ONLY
 * when they switched their public profile on. Everyone else renders as
 * plain text — the feed never leaks a private profile URL.
 */
export function personHref(author: FeedAuthorView): string | null {
  if (author.isCandidate && author.profilePublic) return `/people/${author.id}`;
  return null;
}

/** Who may delete a post: its author, or a super_admin (moderation). */
export function canDeletePost(
  viewerId: string | null,
  post: Pick<FeedPostView, "author">,
  viewerIsSuperAdmin: boolean,
): boolean {
  if (!viewerId) return false;
  return viewerIsSuperAdmin || post.author.id === viewerId;
}

/** Who may delete a comment: its author, or a super_admin (moderation). */
export function canDeleteComment(
  viewerId: string | null,
  comment: Pick<FeedCommentView, "author">,
  viewerIsSuperAdmin: boolean,
): boolean {
  if (!viewerId) return false;
  return viewerIsSuperAdmin || comment.author.id === viewerId;
}

// ─── Share / repost (migration 0016) ────────────────────────────────────────

/**
 * The post body rule, mirroring the posts_body_check constraint:
 * at most POST_BODY_MAX characters, and an empty body is allowed ONLY for
 * a repost (a "pure repost" with no comment of its own). The body is
 * trimmed before storage, so length is measured after trimming.
 */
export function isValidPostBody(body: string, opts: { isRepost?: boolean } = {}): boolean {
  const len = body.trim().length;
  if (len > POST_BODY_MAX) return false;
  return len >= 1 || opts.isRepost === true;
}

/**
 * A post can be shared unless it is itself a repost (share the original
 * instead) or share support isn't live yet (pre-migration 0016).
 */
export function canSharePost(post: Pick<FeedPostView, "isRepost" | "shareEnabled">): boolean {
  return post.shareEnabled && !post.isRepost;
}

// ─── Follow (migration 0016) ────────────────────────────────────────────────

/** A follow target: exactly one of a person or a company. */
export type FollowTarget =
  | { kind: "profile"; profileId: string }
  | { kind: "org"; orgId: string };

/**
 * Resolve a follow target from optional ids. Returns null unless EXACTLY
 * one of profileId / orgId is set — mirrors the follows_exactly_one_target
 * CHECK constraint in migration 0016.
 */
export function resolveFollowTarget(input: {
  profileId?: string | null;
  orgId?: string | null;
}): FollowTarget | null {
  const hasProfile = Boolean(input.profileId);
  const hasOrg = Boolean(input.orgId);
  if (hasProfile === hasOrg) return null;
  return hasProfile
    ? { kind: "profile", profileId: input.profileId as string }
    : { kind: "org", orgId: input.orgId as string };
}

/**
 * Who may follow a target: any signed-in user, except following your own
 * person profile. (Following your own company is blocked one level up,
 * where org membership is known.)
 */
export function canFollowTarget(viewerId: string | null, target: FollowTarget): boolean {
  if (!viewerId) return false;
  if (target.kind === "profile" && target.profileId === viewerId) return false;
  return true;
}
