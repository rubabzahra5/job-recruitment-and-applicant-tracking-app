"use client";

import { useRef, useState, useTransition } from "react";
import { Repeat2, X } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { POST_BODY_MAX, type FeedAuthorView, type FeedPostView } from "@/lib/feed-shared";
import { createPost, fetchFeedPage } from "../_actions";
import { PostCard, type PostCardHandlers, type PostCardViewer } from "../../_components/PostCard";
import { usePostList } from "../../_components/usePostList";

export interface FeedOrgOption {
  id: string;
  name: string;
}

export interface FeedJobOption {
  id: string;
  title: string;
}

export interface FeedClientProps {
  initialPosts: FeedPostView[];
  initialCursor: string | null;
  viewer: PostCardViewer & { author: FeedAuthorView };
  orgOptions: FeedOrgOption[];
  jobsByOrg: Record<string, FeedJobOption[]>;
}

export function FeedClient({
  initialPosts,
  initialCursor,
  viewer,
  orgOptions,
  jobsByOrg,
}: FeedClientProps) {
  const { posts, handlers, error, prependPost, appendPosts } = usePostList(initialPosts, viewer, {
    prependCreatedPosts: true,
  });
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);

  // Composer state
  const [body, setBody] = useState("");
  const [asOrgId, setAsOrgId] = useState<string>("");
  const [jobId, setJobId] = useState<string>("");
  const [composerError, setComposerError] = useState<string | null>(null);
  const [isPosting, startPosting] = useTransition();

  // Quote mode: when set, the composer shares this post with your thoughts.
  const [quoteOf, setQuoteOf] = useState<FeedPostView | null>(null);
  const composerRef = useRef<HTMLElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const cardHandlers: PostCardHandlers = {
    ...handlers,
    onQuoteRepost: (post) => {
      setQuoteOf(post);
      setComposerError(null);
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => textareaRef.current?.focus(), 350);
    },
  };

  const orgJobs = asOrgId ? (jobsByOrg[asOrgId] ?? []) : [];

  const submitPost = () => {
    const text = body.trim();
    setComposerError(null);
    if (quoteOf) {
      const target = quoteOf;
      startPosting(async () => {
        const done = await handlers.onRepostWithBody(target, text);
        if (!done) {
          setComposerError("Your share could not be posted. Please try again.");
          return;
        }
        setQuoteOf(null);
        setBody("");
      });
      return;
    }
    if (!text) return;
    startPosting(async () => {
      const res = await createPost({
        body: text,
        orgId: asOrgId || null,
        jobId: asOrgId && jobId ? jobId : null,
      });
      if (!res.ok) {
        setComposerError(res.error ?? "Your post could not be published.");
        return;
      }
      if (res.post) prependPost(res.post);
      setBody("");
      setJobId("");
    });
  };

  const loadMore = () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    void fetchFeedPage(cursor).then((res) => {
      setLoadingMore(false);
      if (res.ok && res.ready && res.page) {
        appendPosts(res.page.posts);
        setCursor(res.page.nextCursor);
      } else if (res.ok) {
        setCursor(null);
      }
    });
  };

  return (
    <div>
      {/* Composer */}
      <section
        ref={composerRef}
        aria-label="Create a post"
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <Avatar name={viewer.author.name} size="md" />
          <div className="min-w-0 flex-1">
            <label htmlFor="feed-composer" className="sr-only">
              Share an update
            </label>
            <textarea
              id="feed-composer"
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={POST_BODY_MAX}
              placeholder={
                quoteOf
                  ? "Add your thoughts on this post…"
                  : "Share an update with the TalentBridge community…"
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {quoteOf && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 p-3">
                <Repeat2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-brand-900">
                    Sharing {quoteOf.org ? quoteOf.org.name : quoteOf.author.name}&rsquo;s post
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{quoteOf.body}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setQuoteOf(null)}
                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
                  aria-label="Cancel share"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {body.length}/{POST_BODY_MAX}
              </p>
              {!quoteOf && orgOptions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="feed-post-as" className="text-xs font-medium text-slate-600">
                    Post as
                  </label>
                  <select
                    id="feed-post-as"
                    value={asOrgId}
                    onChange={(e) => {
                      setAsOrgId(e.target.value);
                      setJobId("");
                    }}
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
                  >
                    <option value="">Myself ({viewer.author.name})</option>
                    {orgOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} (company)
                      </option>
                    ))}
                  </select>
                  {asOrgId && orgJobs.length > 0 && (
                    <>
                      <label htmlFor="feed-post-job" className="text-xs font-medium text-slate-600">
                        Share a job
                      </label>
                      <select
                        id="feed-post-job"
                        value={jobId}
                        onChange={(e) => setJobId(e.target.value)}
                        className="max-w-56 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
                      >
                        <option value="">None</option>
                        {orgJobs.map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.title}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              )}
            </div>
            {composerError && (
              <Alert tone="error" className="mt-2">
                {composerError}
              </Alert>
            )}
            <div className="mt-3 flex justify-end">
              <Button
                onClick={submitPost}
                isLoading={isPosting}
                disabled={!quoteOf && body.trim().length === 0}
              >
                {quoteOf ? "Share post" : "Post"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Posts */}
      <div className="mt-6 space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {posts.length === 0 ? (
          <EmptyState
            title="No posts yet"
            description="Be the first to share an update — a new role at your company, a career milestone, or a hiring announcement."
          />
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} post={post} viewer={viewer} handlers={cardHandlers} />
          ))
        )}
      </div>

      {cursor && posts.length > 0 && (
        <div className="mt-6 text-center">
          <Button variant="secondary" onClick={loadMore} isLoading={loadingMore}>
            Load more posts
          </Button>
        </div>
      )}
    </div>
  );
}
