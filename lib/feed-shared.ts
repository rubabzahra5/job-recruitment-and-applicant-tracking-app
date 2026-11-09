/**
 * Community feed — shared types and pure helpers.
 *
 * Plain TS (no "server-only", no Supabase imports): used by the server data
 * layer (lib/feed.ts), server actions, client components and unit tests.
 * The feed itself lives in the posts / post_likes / post_comments tables
 * (migration 0015) and the /feed route in app/(public)/feed.
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
