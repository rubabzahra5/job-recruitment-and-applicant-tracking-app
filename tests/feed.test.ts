import { describe, expect, it } from "vitest";

import {
  canDeleteComment,
  canDeletePost,
  canFollowTarget,
  canSharePost,
  isValidPostBody,
  personHref,
  resolveFollowTarget,
  POST_BODY_MAX,
  COMMENT_BODY_MAX,
  type FeedAuthorView,
  type FeedCommentView,
  type FeedPostView,
} from "@/lib/feed-shared";
import {
  createCommentSchema,
  createPostSchema,
  createRepostSchema,
  followTargetSchema,
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

describe("repost body rule (migration 0016)", () => {
  it("a pure repost may have an empty body", () => {
    expect(isValidPostBody("", { isRepost: true })).toBe(true);
    expect(isValidPostBody("   ", { isRepost: true })).toBe(true);
    expect(createRepostSchema.safeParse({ originalPostId: POST_ID, body: "" }).success).toBe(true);
  });

  it("a normal post may NOT have an empty body", () => {
    expect(isValidPostBody("")).toBe(false);
    expect(isValidPostBody("", { isRepost: false })).toBe(false);
    expect(isValidPostBody("   ")).toBe(false);
  });

  it("a repost with thoughts accepts text up to the limit", () => {
    expect(isValidPostBody("Worth a read!", { isRepost: true })).toBe(true);
    expect(
      createRepostSchema.safeParse({ originalPostId: POST_ID, body: "a".repeat(POST_BODY_MAX) })
        .success,
    ).toBe(true);
  });

  it("rejects over-long repost bodies and bad original ids", () => {
    expect(isValidPostBody("a".repeat(POST_BODY_MAX + 1), { isRepost: true })).toBe(false);
    expect(
      createRepostSchema.safeParse({
        originalPostId: POST_ID,
        body: "a".repeat(POST_BODY_MAX + 1),
      }).success,
    ).toBe(false);
    expect(createRepostSchema.safeParse({ body: "hi" }).success).toBe(false);
    expect(createRepostSchema.safeParse({ originalPostId: "nope", body: "" }).success).toBe(false);
  });
});

describe("canSharePost", () => {
  it("normal posts can be shared once 0016 is live", () => {
    expect(canSharePost({ isRepost: false, shareEnabled: true })).toBe(true);
  });

  it("a repost cannot itself be reposted", () => {
    expect(canSharePost({ isRepost: true, shareEnabled: true })).toBe(false);
  });

  it("nothing can be shared before migration 0016", () => {
    expect(canSharePost({ isRepost: false, shareEnabled: false })).toBe(false);
  });
});

describe("follow target rule (migration 0016)", () => {
  it("resolves exactly one target", () => {
    expect(resolveFollowTarget({ profileId: "user-9" })).toEqual({
      kind: "profile",
      profileId: "user-9",
    });
    expect(resolveFollowTarget({ orgId: ORG_ID })).toEqual({ kind: "org", orgId: ORG_ID });
  });

  it("rejects both targets and neither target", () => {
    expect(resolveFollowTarget({ profileId: "user-9", orgId: ORG_ID })).toBeNull();
    expect(resolveFollowTarget({})).toBeNull();
    expect(resolveFollowTarget({ profileId: null, orgId: null })).toBeNull();
  });

  it("the zod schema enforces the same rule", () => {
    expect(followTargetSchema.safeParse({ profileId: POST_ID }).success).toBe(true);
    expect(followTargetSchema.safeParse({ orgId: ORG_ID }).success).toBe(true);
    expect(followTargetSchema.safeParse({ profileId: POST_ID, orgId: ORG_ID }).success).toBe(false);
    expect(followTargetSchema.safeParse({}).success).toBe(false);
  });

  it("canFollowTarget blocks anonymous users and self-follows", () => {
    const person = { kind: "profile", profileId: "user-9" } as const;
    const org = { kind: "org", orgId: ORG_ID } as const;
    expect(canFollowTarget(null, person)).toBe(false);
    expect(canFollowTarget("user-9", person)).toBe(false);
    expect(canFollowTarget("user-1", person)).toBe(true);
    expect(canFollowTarget("user-1", org)).toBe(true);
  });
});
