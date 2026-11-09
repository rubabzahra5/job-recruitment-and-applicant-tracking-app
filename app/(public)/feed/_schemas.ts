import { z } from "zod";

import { COMMENT_BODY_MAX, POST_BODY_MAX } from "@/lib/feed-shared";

/**
 * Zod schemas for the community feed (app/(public)/feed).
 * Plain TS: imported by the server actions AND unit tests.
 * Length limits mirror the CHECK constraints in migration 0015.
 */

export const createPostSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write something before posting.")
    .max(POST_BODY_MAX, `Posts can be at most ${POST_BODY_MAX} characters.`),
  /** Post "as" this organization (must be one the author belongs to). */
  orgId: z.string().uuid("Invalid organization.").optional().nullable(),
  /** Share one of the organization's published jobs in the post. */
  jobId: z.string().uuid("Invalid job.").optional().nullable(),
});
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const createCommentSchema = z.object({
  postId: z.string().uuid("Invalid post."),
  body: z
    .string()
    .trim()
    .min(1, "Write something before commenting.")
    .max(COMMENT_BODY_MAX, `Comments can be at most ${COMMENT_BODY_MAX} characters.`),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const postIdSchema = z.string().uuid("Invalid post.");
export const commentIdSchema = z.string().uuid("Invalid comment.");
