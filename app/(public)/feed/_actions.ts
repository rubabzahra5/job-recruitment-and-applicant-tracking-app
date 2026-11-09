"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUser, requireSessionUser } from "@/lib/auth";
import { getFeedPost, listFeedPosts, type FeedPage } from "@/lib/feed";
import {
  canFollowTarget,
  resolveFollowTarget,
  type FeedPostView,
} from "@/lib/feed-shared";
import { checkRateLimit } from "@/lib/rate-limit";
import { isSuperAdmin, requireOrgMembership } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  commentIdSchema,
  createCommentSchema,
  createPostSchema,
  createRepostSchema,
  followTargetSchema,
  postIdSchema,
  type CreateCommentInput,
  type CreatePostInput,
  type CreateRepostInput,
  type FollowTargetInput,
} from "./_schemas";

/**
 * Community feed server actions (migration 0015).
 *
 * Authorization model (the service-role client bypasses RLS, so every
 * action authorizes in code via lib/rbac.ts — the same contract as the
 * candidate/employer portals):
 * - every action requires a signed-in user;
 * - posting "as" an organization requires an active membership in it;
 * - attaching a job requires the job to belong to that org and be published;
 * - delete is limited to the author, or a super_admin (moderation).
 * Reposts (0016) are always personal (never "as" an org), can't target
 * another repost, and are limited to one per user per original post.
 * Follows (0016) are self-service only: follower is always the caller.
 * RLS policies in 0015_feed.sql / 0016_share_follow.sql enforce the same
 * rules for direct API use.
 */

export interface FeedActionResult {
  ok: boolean;
  error?: string;
}

const okResult: FeedActionResult = { ok: true };

function fail(error: string): FeedActionResult {
  return { ok: false, error };
}

function firstZodError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid input.";
}

/** Tables missing (pre-migration) and other DB errors land here. */
function dbFail(e: unknown): FeedActionResult {
  console.error("[feed] action failed:", e);
  return fail("The feed is still being set up. Please try again soon.");
}

export async function createPost(
  input: CreatePostInput,
): Promise<FeedActionResult & { post?: FeedPostView }> {
  try {
    const user = await requireSessionUser();
    const parsed = createPostSchema.parse(input);

    const limit = await checkRateLimit("feed_post", user.id, 10, 600);
    if (!limit.allowed) {
      return fail(`You're posting too quickly. Try again in ${limit.retryAfterSec}s.`);
    }

    const admin = createAdminClient();
    let orgId: string | null = null;
    let jobId: string | null = null;

    if (parsed.orgId) {
      // Posting as a company requires an active membership in it.
      await requireOrgMembership(user.id, parsed.orgId);
      orgId = parsed.orgId;

      if (parsed.jobId) {
        // The attached job must be one of this org's published jobs.
        const { data: job, error } = await admin
          .from("jobs")
          .select("id, org_id, status")
          .eq("id", parsed.jobId)
          .maybeSingle();
        if (error) throw error;
        if (!job || (job.org_id as string) !== orgId || job.status !== "published") {
          return fail("You can only share your company's published jobs.");
        }
        jobId = parsed.jobId;
      }
    } else if (parsed.jobId) {
      return fail("Choose your company before sharing a job.");
    }

    const { data, error } = await admin
      .from("posts")
      .insert({ author_id: user.id, org_id: orgId, job_id: jobId, body: parsed.body })
      .select("id")
      .single();
    if (error) throw error;

    const post = await getFeedPost(user.id, data.id as string);
    revalidatePath("/feed");
    return { ok: true, post: post ?? undefined };
  } catch (e) {
    if (e instanceof z.ZodError) return fail(firstZodError(e));
    if (e instanceof Error && e.message === "Authentication required.") {
      return fail("Please log in to post.");
    }
    if (e instanceof Error && e.name === "AuthorizationError") {
      return fail("You can only post as a company you belong to.");
    }
    return dbFail(e);
  }
}

export async function deletePost(
  postId: string,
): Promise<FeedActionResult> {
  try {
    const user = await requireSessionUser();
    const id = postIdSchema.parse(postId);
    const admin = createAdminClient();

    const { data: post, error } = await admin
      .from("posts")
      .select("id, author_id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!post) return fail("Post not found.");

    const mine = (post.author_id as string) === user.id;
    if (!mine && !(await isSuperAdmin(user.id))) {
      return fail("You can only delete your own posts.");
    }

    const { error: delError } = await admin.from("posts").delete().eq("id", id);
    if (delError) throw delError;
    revalidatePath("/feed");
    return okResult;
  } catch (e) {
    if (e instanceof z.ZodError) return fail(firstZodError(e));
    return dbFail(e);
  }
}

export async function toggleLike(
  postId: string,
): Promise<FeedActionResult & { liked?: boolean }> {
  try {
    const user = await requireSessionUser();
    const id = postIdSchema.parse(postId);
    const admin = createAdminClient();

    const { data: existing, error } = await admin
      .from("post_likes")
      .select("post_id")
      .eq("post_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;

    if (existing) {
      const { error: delError } = await admin
        .from("post_likes")
        .delete()
        .eq("post_id", id)
        .eq("user_id", user.id);
      if (delError) throw delError;
      return { ok: true, liked: false };
    }

    const { error: insError } = await admin
      .from("post_likes")
      .insert({ post_id: id, user_id: user.id });
    if (insError) throw insError;
    return { ok: true, liked: true };
  } catch (e) {
    if (e instanceof z.ZodError) return fail(firstZodError(e));
    return dbFail(e);
  }
}

export async function addComment(
  input: CreateCommentInput,
): Promise<FeedActionResult & { commentId?: string }> {
  try {
    const user = await requireSessionUser();
    const parsed = createCommentSchema.parse(input);

    const limit = await checkRateLimit("feed_comment", user.id, 30, 600);
    if (!limit.allowed) {
      return fail(`You're commenting too quickly. Try again in ${limit.retryAfterSec}s.`);
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("post_comments")
      .insert({ post_id: parsed.postId, author_id: user.id, body: parsed.body })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, commentId: data.id as string };
  } catch (e) {
    if (e instanceof z.ZodError) return fail(firstZodError(e));
    return dbFail(e);
  }
}

export async function deleteComment(
  commentId: string,
): Promise<FeedActionResult> {
  try {
    const user = await requireSessionUser();
    const id = commentIdSchema.parse(commentId);
    const admin = createAdminClient();

    const { data: comment, error } = await admin
      .from("post_comments")
      .select("id, author_id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!comment) return fail("Comment not found.");

    const mine = (comment.author_id as string) === user.id;
    if (!mine && !(await isSuperAdmin(user.id))) {
      return fail("You can only delete your own comments.");
    }

    const { error: delError } = await admin.from("post_comments").delete().eq("id", id);
    if (delError) throw delError;
    return okResult;
  } catch (e) {
    if (e instanceof z.ZodError) return fail(firstZodError(e));
    return dbFail(e);
  }
}

/** "Load more" for the feed client: the next page older than `before`. */
export async function fetchFeedPage(
  before: string,
): Promise<FeedActionResult & { ready?: boolean; page?: FeedPage }> {
  const user = await getSessionUser();
  if (!user) return fail("Please log in.");
  const result = await listFeedPosts(user.id, { before });
  if (!result.ready) return { ok: true, ready: false };
  return { ok: true, ready: true, page: result.data };
}

/**
 * Repost (share) a post — migration 0016. `body` is the sharer's own
 * comment and may be empty ("repost now"). Reposts are personal, cannot
 * target another repost (share the original instead), and each user may
 * repost a given post at most once.
 */
export async function createRepost(
  input: CreateRepostInput,
): Promise<FeedActionResult & { post?: FeedPostView }> {
  try {
    const user = await requireSessionUser();
    const parsed = createRepostSchema.parse(input);

    const limit = await checkRateLimit("feed_post", user.id, 10, 600);
    if (!limit.allowed) {
      return fail(`You're sharing too quickly. Try again in ${limit.retryAfterSec}s.`);
    }

    const admin = createAdminClient();

    const { data: original, error } = await admin
      .from("posts")
      .select("id, original_post_id")
      .eq("id", parsed.originalPostId)
      .maybeSingle();
    if (error) throw error;
    if (!original) return fail("That post no longer exists.");
    if (original.original_post_id) {
      return fail("This is already a shared post — share the original post instead.");
    }

    const { data: existing } = await admin
      .from("posts")
      .select("id")
      .eq("author_id", user.id)
      .eq("original_post_id", parsed.originalPostId)
      .maybeSingle();
    if (existing) return fail("You've already shared this post.");

    const { data, error: insError } = await admin
      .from("posts")
      .insert({
        author_id: user.id,
        org_id: null,
        job_id: null,
        body: parsed.body,
        original_post_id: parsed.originalPostId,
      })
      .select("id")
      .single();
    if (insError) throw insError;

    const post = await getFeedPost(user.id, data.id as string);
    revalidatePath("/feed");
    return { ok: true, post: post ?? undefined };
  } catch (e) {
    if (e instanceof z.ZodError) return fail(firstZodError(e));
    if (e instanceof Error && e.message === "Authentication required.") {
      return fail("Please log in to share posts.");
    }
    return dbFail(e);
  }
}

/**
 * Follow / unfollow a person or a company — migration 0016. Toggles the
 * caller's follow and returns the new state + follower count so the
 * button can update without a page reload.
 */
export async function toggleFollow(
  input: FollowTargetInput,
): Promise<FeedActionResult & { following?: boolean; followerCount?: number }> {
  try {
    const user = await requireSessionUser();
    const parsed = followTargetSchema.parse(input);
    const target = resolveFollowTarget(parsed);
    if (!target) return fail("Choose exactly one person or company to follow.");
    if (!canFollowTarget(user.id, target)) {
      return fail("You can't follow your own profile.");
    }

    const limit = await checkRateLimit("feed_follow", user.id, 60, 600);
    if (!limit.allowed) {
      return fail(`You're doing that too quickly. Try again in ${limit.retryAfterSec}s.`);
    }

    const admin = createAdminClient();
    const targetColumn = target.kind === "profile" ? "follow_profile_id" : "follow_org_id";
    const targetId = target.kind === "profile" ? target.profileId : target.orgId;

    // The target must exist (and, for profiles, be followable at all).
    if (target.kind === "profile") {
      const { data: profile, error } = await admin
        .from("profiles")
        .select("id")
        .eq("id", targetId)
        .maybeSingle();
      if (error) throw error;
      if (!profile) return fail("That profile no longer exists.");
    } else {
      const { data: org, error } = await admin
        .from("organizations")
        .select("id")
        .eq("id", targetId)
        .maybeSingle();
      if (error) throw error;
      if (!org) return fail("That company no longer exists.");
    }

    const { data: existing, error } = await admin
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq(targetColumn, targetId)
      .maybeSingle();
    if (error) throw error;

    let following: boolean;
    if (existing) {
      const { error: delError } = await admin
        .from("follows")
        .delete()
        .eq("id", existing.id as string);
      if (delError) throw delError;
      following = false;
    } else {
      const { error: insError } = await admin.from("follows").insert({
        follower_id: user.id,
        follow_profile_id: target.kind === "profile" ? targetId : null,
        follow_org_id: target.kind === "org" ? targetId : null,
      });
      if (insError) throw insError;
      following = true;
    }

    const { count, error: countError } = await admin
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq(targetColumn, targetId);
    if (countError) throw countError;

    return { ok: true, following, followerCount: count ?? 0 };
  } catch (e) {
    if (e instanceof z.ZodError) return fail(firstZodError(e));
    if (e instanceof Error && e.message === "Authentication required.") {
      return fail("Please log in to follow.");
    }
    return dbFail(e);
  }
}
