import { describe, expect, it } from "vitest";

import {
  canDeleteComment,
  canDeletePost,
  personHref,
  POST_BODY_MAX,
  COMMENT_BODY_MAX,
  type FeedAuthorView,
  type FeedCommentView,
  type FeedPostView,
} from "@/lib/feed-shared";
import {
  createCommentSchema,
  createPostSchema,
} from "@/app/(public)/feed/_schemas";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const POST_ID = "33333333-3333-4333-8333-333333333333";

describe("createPostSchema", () => {
  it("accepts a plain personal post", () => {
    const r = createPostSchema.safeParse({ body: "Hello TalentBridge!" });
    expect(r.success).toBe(true);
  });

  it("accepts a company post with a shared job", () => {
    const r = createPostSchema.safeParse({
      body: "We are hiring!",
      orgId: ORG_ID,
      jobId: JOB_ID,
    });
    expect(r.success).toBe(true);
  });

  it("trims and rejects an empty or whitespace-only body", () => {
    expect(createPostSchema.safeParse({ body: "" }).success).toBe(false);
    expect(createPostSchema.safeParse({ body: "   \n  " }).success).toBe(false);
  });

  it("enforces the 2000 character limit", () => {
    expect(createPostSchema.safeParse({ body: "a".repeat(POST_BODY_MAX) }).success).toBe(true);
    expect(createPostSchema.safeParse({ body: "a".repeat(POST_BODY_MAX + 1) }).success).toBe(false);
  });

  it("rejects malformed org/job ids", () => {
    expect(createPostSchema.safeParse({ body: "hi", orgId: "not-a-uuid" }).success).toBe(false);
    expect(createPostSchema.safeParse({ body: "hi", orgId: ORG_ID, jobId: "x" }).success).toBe(false);
  });
});

describe("createCommentSchema", () => {
  it("accepts a valid comment", () => {
    const r = createCommentSchema.safeParse({ postId: POST_ID, body: "Great news!" });
    expect(r.success).toBe(true);
  });

  it("rejects empty comments and missing post ids", () => {
    expect(createCommentSchema.safeParse({ postId: POST_ID, body: " " }).success).toBe(false);
    expect(createCommentSchema.safeParse({ body: "hello" }).success).toBe(false);
    expect(createCommentSchema.safeParse({ postId: "nope", body: "hello" }).success).toBe(false);
  });

  it("enforces the 500 character limit", () => {
    expect(
      createCommentSchema.safeParse({ postId: POST_ID, body: "b".repeat(COMMENT_BODY_MAX) }).success,
    ).toBe(true);
    expect(
      createCommentSchema.safeParse({ postId: POST_ID, body: "b".repeat(COMMENT_BODY_MAX + 1) }).success,
    ).toBe(false);
  });
});

const author = (over: Partial<FeedAuthorView> = {}): FeedAuthorView => ({
  id: "user-1",
  name: "Ayesha Khan",
  headline: null,
  isCandidate: true,
  profilePublic: false,
  ...over,
});

describe("personHref (privacy link rule)", () => {
  it("links to the public page only for a public candidate", () => {
    expect(personHref(author({ profilePublic: true }))).toBe("/people/user-1");
  });

  it("never links a private candidate's profile", () => {
    expect(personHref(author({ profilePublic: false }))).toBeNull();
  });

  it("never links a non-candidate account", () => {
    expect(personHref(author({ isCandidate: false, profilePublic: true }))).toBeNull();
  });
});

describe("delete permissions", () => {
  const post = { author: author() } as Pick<FeedPostView, "author">;
  const comment = { author: author() } as Pick<FeedCommentView, "author">;

  it("authors can delete their own posts and comments", () => {
    expect(canDeletePost("user-1", post, false)).toBe(true);
    expect(canDeleteComment("user-1", comment, false)).toBe(true);
  });

  it("other users cannot delete", () => {
    expect(canDeletePost("user-2", post, false)).toBe(false);
    expect(canDeleteComment("user-2", comment, false)).toBe(false);
  });

  it("super admins can delete anything (moderation)", () => {
    expect(canDeletePost("admin-9", post, true)).toBe(true);
    expect(canDeleteComment("admin-9", comment, true)).toBe(true);
  });

  it("anonymous viewers cannot delete", () => {
    expect(canDeletePost(null, post, false)).toBe(false);
    expect(canDeleteComment(null, comment, false)).toBe(false);
  });
});
