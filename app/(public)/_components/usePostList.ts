"use client";

import { useCallback, useState } from "react";

import type { FeedAuthorView, FeedPostView } from "@/lib/feed-shared";
import {
  addComment,
  createRepost,
  deleteComment,
  deletePost,
  toggleLike,
} from "../feed/_actions";
import type { PostCardHandlers, PostCardViewer } from "./PostCard";

/**
 * Shared post-list state + server-action handlers.
 *
 * Used by the /feed client and by post lists embedded on company pages and
 * public profiles. Likes/comments update optimistically and roll back when
 * the server action fails; the error surfaces via `error`.
 *
 * Reposts are NOT optimistic (the server returns the new post view and
 * enforces one-repost-per-user), but the original's share count patches
 * locally on success. `prependCreatedPosts` is on for the main feed (your
 * repost appears at the top) and off for embedded lists (a company page
 * shouldn't suddenly show your personal repost in the company's list).
 */
export function usePostList(
  initialPosts: FeedPostView[],
  viewer: (PostCardViewer & { author: FeedAuthorView }) | null,
  opts: { prependCreatedPosts?: boolean } = {},
) {
  const [posts, setPosts] = useState<FeedPostView[]>(initialPosts);
  const [error, setError] = useState<string | null>(null);

  const patchPost = useCallback((postId: string, patch: (p: FeedPostView) => FeedPostView) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? patch(p) : p)));
  }, []);

  const handlers: Pick<
    PostCardHandlers,
    "onToggleLike" | "onDeletePost" | "onAddComment" | "onDeleteComment"
  > = {
    onToggleLike: useCallback(
      (post: FeedPostView) => {
        if (!viewer) return;
        const wasLiked = post.likedByMe;
        patchPost(post.id, (p) => ({
          ...p,
          likedByMe: !wasLiked,
          likeCount: Math.max(0, p.likeCount + (wasLiked ? -1 : 1)),
        }));
        void toggleLike(post.id).then((res) => {
          if (!res.ok) {
            patchPost(post.id, (p) => ({
              ...p,
              likedByMe: wasLiked,
              likeCount: Math.max(0, p.likeCount + (wasLiked ? 1 : -1)),
            }));
            setError(res.error ?? "Could not update your like.");
          }
        });
      },
      [viewer, patchPost],
    ),

    onDeletePost: useCallback(
      (post: FeedPostView) => {
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
        void deletePost(post.id).then((res) => {
          if (!res.ok) {
            setPosts((prev) => [post, ...prev]);
            setError(res.error ?? "Could not delete the post.");
          }
        });
      },
      [],
    ),

    onAddComment: useCallback(
      async (post: FeedPostView, body: string): Promise<boolean> => {
        if (!viewer) return false;
        const res = await addComment({ postId: post.id, body });
        if (!res.ok || !res.commentId) {
          setError(res.error ?? "Could not post your comment.");
          return false;
        }
        patchPost(post.id, (p) => ({
          ...p,
          commentCount: p.commentCount + 1,
          comments: [
            ...p.comments,
            {
              id: res.commentId as string,
              body,
              createdAt: new Date().toISOString(),
              author: viewer.author,
            },
          ],
        }));
        return true;
      },
      [viewer, patchPost],
    ),

    onDeleteComment: useCallback(
      (post: FeedPostView, commentId: string) => {
        const removed = post.comments.find((c) => c.id === commentId);
        patchPost(post.id, (p) => ({
          ...p,
          commentCount: Math.max(0, p.commentCount - 1),
          comments: p.comments.filter((c) => c.id !== commentId),
        }));
        void deleteComment(commentId).then((res) => {
          if (!res.ok && removed) {
            patchPost(post.id, (p) => ({
              ...p,
              commentCount: p.commentCount + 1,
              comments: [...p.comments, removed],
            }));
            setError(res.error ?? "Could not delete the comment.");
          }
        });
      },
      [patchPost],
    ),
  };

  const prependPost = useCallback((post: FeedPostView) => {
    setPosts((prev) => [post, ...prev]);
  }, []);

  const runRepost = useCallback(
    async (post: FeedPostView, body: string): Promise<FeedPostView | null> => {
      if (!viewer) return null;
      const res = await createRepost({ originalPostId: post.id, body });
      if (!res.ok || !res.post) {
        setError(res.error ?? "Could not share this post.");
        return null;
      }
      patchPost(post.id, (p) => ({ ...p, shareCount: p.shareCount + 1, sharedByMe: true }));
      if (opts.prependCreatedPosts) prependPost(res.post);
      return res.post;
    },
    [viewer, patchPost, prependPost, opts.prependCreatedPosts],
  );

  const repostHandlers = {
    onRepostNow: useCallback(
      (post: FeedPostView) => {
        void runRepost(post, "");
      },
      [runRepost],
    ),
    onRepostWithBody: useCallback(
      async (post: FeedPostView, body: string): Promise<boolean> => {
        return (await runRepost(post, body)) !== null;
      },
      [runRepost],
    ),
  };

  const allHandlers: PostCardHandlers = { ...handlers, ...repostHandlers };

  const appendPosts = useCallback((more: FeedPostView[]) => {
    setPosts((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      return [...prev, ...more.filter((p) => !seen.has(p.id))];
    });
  }, []);

  return { posts, handlers: allHandlers, error, prependPost, appendPosts };
}
