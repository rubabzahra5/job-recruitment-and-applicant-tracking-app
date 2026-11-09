"use client";

import { useCallback, useState } from "react";

import type { FeedAuthorView, FeedPostView } from "@/lib/feed-shared";
import {
  addComment,
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
 */
export function usePostList(
  initialPosts: FeedPostView[],
  viewer: (PostCardViewer & { author: FeedAuthorView }) | null,
) {
  const [posts, setPosts] = useState<FeedPostView[]>(initialPosts);
  const [error, setError] = useState<string | null>(null);

  const patchPost = useCallback((postId: string, patch: (p: FeedPostView) => FeedPostView) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? patch(p) : p)));
  }, []);

  const handlers: PostCardHandlers = {
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

  const appendPosts = useCallback((more: FeedPostView[]) => {
    setPosts((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      return [...prev, ...more.filter((p) => !seen.has(p.id))];
    });
  }, []);

  return { posts, handlers, error, prependPost, appendPosts };
}
