"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Briefcase, Heart, MessageCircle, PenLine, Repeat2, Share2, Trash2, X } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { timeAgo } from "@/lib/format";
import {
  canDeleteComment,
  canDeletePost,
  canSharePost,
  personHref,
  COMMENT_BODY_MAX,
  POST_BODY_MAX,
  type FeedAuthorView,
  type FeedOriginalPostView,
  type FeedPostView,
} from "@/lib/feed-shared";
/**
 * Display labels for the shared-job strip. Kept local because this is a
 * client component and app/(public)/_lib/public-data.ts is server-only
 * (it imports next/headers). Values mirror EMPLOYMENT_TYPE_LABELS /
 * WORKPLACE_LABELS in public-data.ts.
 */
const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  temporary: "Temporary",
  internship: "Internship",
  apprenticeship: "Apprenticeship",
  freelance: "Freelance",
};

const WORKPLACE_LABELS: Record<string, string> = {
  on_site: "On-site",
  hybrid: "Hybrid",
  remote: "Remote",
};


/**
 * One feed post card — shared by /feed, company pages and public profiles.
 *
 * Interactivity is delegated to callbacks (the parent owns the list state
 * and calls the server actions in app/(public)/feed/_actions.ts). When
 * `viewer` is null (anonymous visitor on a public page) the card is
 * read-only and the like/comment controls become login links.
 */

export interface PostCardViewer {
  id: string;
  isSuperAdmin: boolean;
}

export interface PostCardHandlers {
  onToggleLike: (post: FeedPostView) => void;
  onDeletePost: (post: FeedPostView) => void;
  onAddComment: (post: FeedPostView, body: string) => Promise<boolean>;
  onDeleteComment: (post: FeedPostView, commentId: string) => void;
  /** Share immediately, with no added comment ("Repost now"). */
  onRepostNow: (post: FeedPostView) => void;
  /** Share with the viewer's own text (inline quote box fallback). */
  onRepostWithBody: (post: FeedPostView, body: string) => Promise<boolean>;
  /**
   * When provided (the /feed page), "Repost with your thoughts" hands the
   * post to the page composer in quote mode instead of the inline box.
   */
  onQuoteRepost?: (post: FeedPostView) => void;
}

function AuthorName({ author, className }: { author: FeedAuthorView; className?: string }) {
  const href = personHref(author);
  if (href) {
    return (
      <Link href={href} className={`hover:text-brand-700 hover:underline ${className ?? ""}`}>
        {author.name}
      </Link>
    );
  }
  return <span className={className}>{author.name}</span>;
}

/** The original post embedded in a repost, rendered as a quoted card. */
function QuotedPost({ original }: { original: FeedOriginalPostView }) {
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-start gap-2.5">
        {original.org ? (
          <>
            {original.org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={original.org.logoUrl}
                alt={`${original.org.name} logo`}
                className="h-9 w-9 shrink-0 rounded-md border border-slate-200 object-contain"
              />
            ) : (
              <div
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-900 text-sm font-bold text-white"
              >
                {original.org.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Link
                  href={`/companies/${original.org.slug}`}
                  className="hover:text-brand-700 hover:underline"
                >
                  {original.org.name}
                </Link>
                {original.org.verified && <Badge tone="success">✓ Verified</Badge>}
              </p>
              <p className="text-xs text-slate-500">
                Posted by <AuthorName author={original.author} /> · {timeAgo(original.createdAt)}
              </p>
            </div>
          </>
        ) : (
          <>
            <Avatar name={original.author.name} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                <AuthorName author={original.author} />
              </p>
              <p className="truncate text-xs text-slate-500">
                {[original.author.headline, timeAgo(original.createdAt)].filter(Boolean).join(" · ")}
              </p>
            </div>
          </>
        )}
      </div>
      <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">
        {original.body}
      </p>
      {original.job && (
        <Link
          href={`/jobs/${original.job.slug}`}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
        >
          <Briefcase className="h-4 w-4" aria-hidden="true" />
          {original.job.title} — view job
        </Link>
      )}
    </div>
  );
}

export function PostCard({
  post,
  viewer,
  handlers,
}: {
  post: FeedPostView;
  viewer: PostCardViewer | null;
  handlers?: PostCardHandlers;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteDraft, setQuoteDraft] = useState("");
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const interactive = Boolean(viewer && handlers);
  const showDeletePost = viewer ? canDeletePost(viewer.id, post, viewer.isSuperAdmin) : false;
  const showShare = interactive && canSharePost(post);

  const submitComment = () => {
    const body = draft.trim();
    if (!body || !handlers) return;
    setCommentError(null);
    startTransition(async () => {
      const added = await handlers.onAddComment(post, body);
      if (added) {
        setDraft("");
      } else {
        setCommentError("Your comment could not be posted. Please try again.");
      }
    });
  };

  const startQuoteRepost = () => {
    setShareMenuOpen(false);
    if (!handlers) return;
    if (handlers.onQuoteRepost) {
      handlers.onQuoteRepost(post);
    } else {
      setQuoteError(null);
      setQuoteOpen(true);
    }
  };

  const submitQuoteRepost = () => {
    if (!handlers) return;
    setQuoteError(null);
    startTransition(async () => {
      const done = await handlers.onRepostWithBody(post, quoteDraft.trim());
      if (done) {
        setQuoteDraft("");
        setQuoteOpen(false);
      } else {
        setQuoteError("Your share could not be posted. Please try again.");
      }
    });
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      {post.isRepost && (
        <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <Repeat2 className="h-3.5 w-3.5" aria-hidden="true" />
          <AuthorName author={post.author} /> shared a post
        </p>
      )}
      {/* Header */}
      <div className="flex items-start gap-3">
        {post.org ? (
          <>
            {post.org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.org.logoUrl}
                alt={`${post.org.name} logo`}
                className="h-11 w-11 shrink-0 rounded-md border border-slate-200 object-contain"
              />
            ) : (
              <div
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-900 text-lg font-bold text-white"
              >
                {post.org.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-900">
                <Link href={`/companies/${post.org.slug}`} className="hover:text-brand-700 hover:underline">
                  {post.org.name}
                </Link>
                {post.org.verified && <Badge tone="success">✓ Verified</Badge>}
              </p>
              <p className="text-xs text-slate-500">
                Posted by <AuthorName author={post.author} /> · {timeAgo(post.createdAt)}
              </p>
            </div>
          </>
        ) : (
          <>
            <Avatar name={post.author.name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">
                <AuthorName author={post.author} />
              </p>
              <p className="truncate text-xs text-slate-500">
                {[post.author.headline, timeAgo(post.createdAt)].filter(Boolean).join(" · ")}
              </p>
            </div>
          </>
        )}
        {showDeletePost && handlers && (
          <button
            type="button"
            onClick={() => handlers.onDeletePost(post)}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
            aria-label="Delete post"
            title="Delete post"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Body (empty for a pure repost — the quote below carries it) */}
      {post.body.trim().length > 0 && (
        <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-800">{post.body}</p>
      )}

      {/* Quoted original for reposts */}
      {post.original && <QuotedPost original={post.original} />}
      {post.originalUnavailable && (
        <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          This shared post is no longer available.
        </div>
      )}

      {/* Shared job */}
      {post.job && (
        <Link
          href={`/jobs/${post.job.slug}`}
          className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-brand-300 hover:bg-brand-50"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white">
            <Briefcase className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-slate-900">{post.job.title}</span>
            <span className="block text-xs text-slate-500">
              {EMPLOYMENT_TYPE_LABELS[post.job.employmentType] ?? post.job.employmentType} ·{" "}
              {post.job.workplace === "remote"
                ? "Remote"
                : `${WORKPLACE_LABELS[post.job.workplace] ?? post.job.workplace} · ${post.job.locationLabel}`}
            </span>
          </span>
          <span className="ml-auto shrink-0 text-sm font-medium text-brand-700">View job →</span>
        </Link>
      )}

      {/* Like / comment bar */}
      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
        {interactive ? (
          <button
            type="button"
            onClick={() => handlers?.onToggleLike(post)}
            aria-pressed={post.likedByMe}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
              post.likedByMe ? "text-red-600 hover:bg-red-50" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Heart className={`h-4 w-4 ${post.likedByMe ? "fill-current" : ""}`} aria-hidden="true" />
            {post.likeCount > 0 ? post.likeCount : ""} Like
          </button>
        ) : (
          <Link
            href="/login?next=/feed"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <Heart className="h-4 w-4" aria-hidden="true" />
            {post.likeCount > 0 ? post.likeCount : ""} Like
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCommentsOpen((v) => !v)}
          aria-expanded={commentsOpen}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          {post.commentCount > 0 ? post.commentCount : ""} Comment{post.commentCount === 1 ? "" : "s"}
        </button>
        {showShare && handlers && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShareMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={shareMenuOpen}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              {post.shareCount > 0 ? post.shareCount : ""} Share
            </button>
            {shareMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setShareMenuOpen(false)}
                  aria-hidden="true"
                />
                <div
                  role="menu"
                  aria-label="Share this post"
                  className="absolute left-0 z-20 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
                >
                  {post.sharedByMe ? (
                    <p className="px-2.5 py-2 text-sm text-slate-500">
                      You&apos;ve already shared this post.
                    </p>
                  ) : (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setShareMenuOpen(false);
                          handlers.onRepostNow(post);
                        }}
                        className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-slate-100"
                      >
                        <Repeat2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                        <span>
                          <span className="block text-sm font-medium text-slate-800">Repost now</span>
                          <span className="block text-xs text-slate-500">
                            Share instantly, just as it is
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={startQuoteRepost}
                        className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-slate-100"
                      >
                        <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                        <span>
                          <span className="block text-sm font-medium text-slate-800">
                            Repost with your thoughts
                          </span>
                          <span className="block text-xs text-slate-500">
                            Add your own comment above the post
                          </span>
                        </span>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {!interactive && post.shareEnabled && post.shareCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-slate-500">
            <Share2 className="h-4 w-4" aria-hidden="true" />
            {post.shareCount} Share{post.shareCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* Inline quote box ("Repost with your thoughts" without a page composer) */}
      {quoteOpen && handlers && (
        <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-800">Repost with your thoughts</p>
            <button
              type="button"
              onClick={() => setQuoteOpen(false)}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
              aria-label="Cancel share"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <label htmlFor={`quote-${post.id}`} className="sr-only">
            Your thoughts on this post
          </label>
          <textarea
            id={`quote-${post.id}`}
            value={quoteDraft}
            onChange={(e) => setQuoteDraft(e.target.value)}
            rows={3}
            maxLength={POST_BODY_MAX}
            placeholder="Add your thoughts (optional)…"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <div className="mt-1 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {quoteDraft.length}/{POST_BODY_MAX}
            </p>
            <button
              type="button"
              onClick={submitQuoteRepost}
              disabled={isPending}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Share post
            </button>
          </div>
          {quoteError && (
            <p role="alert" className="mt-1 text-sm text-red-600">
              {quoteError}
            </p>
          )}
        </div>
      )}

      {/* Comments */}
      {commentsOpen && (
        <div className="mt-2 border-t border-slate-100 pt-3">
          {post.comments.length === 0 ? (
            <p className="text-sm text-slate-500">No comments yet — start the conversation.</p>
          ) : (
            <ul className="space-y-3">
              {post.comments.map((c) => (
                <li key={c.id} className="flex items-start gap-2.5">
                  <Avatar name={c.author.name} size="xs" />
                  <div className="min-w-0 flex-1 rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs">
                      <AuthorName author={c.author} className="font-semibold text-slate-900" />{" "}
                      <span className="text-slate-400">{timeAgo(c.createdAt)}</span>
                    </p>
                    <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{c.body}</p>
                  </div>
                  {viewer && handlers && canDeleteComment(viewer.id, c, viewer.isSuperAdmin) && (
                    <button
                      type="button"
                      onClick={() => handlers.onDeleteComment(post, c.id)}
                      className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete comment"
                      title="Delete comment"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {interactive ? (
            <div className="mt-3">
              <div className="flex items-start gap-2">
                <label htmlFor={`comment-${post.id}`} className="sr-only">
                  Add a comment
                </label>
                <textarea
                  id={`comment-${post.id}`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  maxLength={COMMENT_BODY_MAX}
                  placeholder="Write a comment…"
                  className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={submitComment}
                  disabled={isPending || draft.trim().length === 0}
                  className="shrink-0 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Comment
                </button>
              </div>
              <p className="mt-1 text-right text-xs text-slate-400">
                {draft.length}/{COMMENT_BODY_MAX}
              </p>
              {commentError && (
                <p role="alert" className="mt-1 text-sm text-red-600">
                  {commentError}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              <Link href="/login?next=/feed" className="font-medium text-brand-700 hover:underline">
                Log in
              </Link>{" "}
              to join the conversation.
            </p>
          )}
        </div>
      )}
    </article>
  );
}
