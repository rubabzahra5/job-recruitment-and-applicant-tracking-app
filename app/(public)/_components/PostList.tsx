"use client";

import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import type { FeedAuthorView, FeedPostView } from "@/lib/feed-shared";
import { PostCard, type PostCardViewer } from "./PostCard";
import { usePostList } from "./usePostList";

/**
 * A rendered list of feed posts with like/comment/delete interactivity.
 *
 * Embedded on public company pages and public candidate profiles. When
 * `viewer` is null the cards render read-only with login links (the
 * company page is public); when signed in, the full interactions work.
 */
export function PostList({
  initialPosts,
  viewer,
  emptyTitle = "No posts yet",
  emptyDescription,
}: {
  initialPosts: FeedPostView[];
  viewer: (PostCardViewer & { author: FeedAuthorView }) | null;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const { posts, handlers, error } = usePostList(initialPosts, viewer);

  if (posts.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      {posts.map((post) => (
        <PostCard key={post.id} post={post} viewer={viewer} handlers={viewer ? handlers : undefined} />
      ))}
    </div>
  );
}
