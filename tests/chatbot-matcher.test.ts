import { describe, expect, it } from "vitest";
import { matchQuestion, normalizeQuestion } from "@/lib/chatbot/matcher";
import { CHAT_SUGGESTIONS, KNOWLEDGE } from "@/lib/chatbot/knowledge";

describe("chatbot matcher", () => {
  it("knowledge base has 40+ entries with unique ids", () => {
    expect(KNOWLEDGE.length).toBeGreaterThanOrEqual(40);
    const ids = new Set(KNOWLEDGE.map((e) => e.id));
    expect(ids.size).toBe(KNOWLEDGE.length);
  });

  it("every link in the knowledge base points at a plausible app route", () => {
    for (const entry of KNOWLEDGE) {
      for (const link of entry.links ?? []) {
        expect(link.href.startsWith("/")).toBe(true);
        expect(link.href).not.toContain(" ");
      }
    }
  });

  it("matches a how-to-apply question", () => {
    const m = matchQuestion("How do I apply for a job?");
    expect(m.isFallback).toBe(false);
    expect(m.entry?.id).toBe("apply-for-job");
  });

  it("matches the free question", () => {
    const m = matchQuestion("Is it free or do I have to pay?");
    expect(m.entry?.id).toBe("is-it-free");
  });

  it("matches the response rule", () => {
    const m = matchQuestion("What is the response time rule? How long do companies take to respond?");
    expect(m.entry?.id).toBe("response-rule");
  });

  it("matches no-response complaints", () => {
    const m = matchQuestion("The company is not responding to my application, I got no reply");
    expect(m.entry?.id).toBe("no-response");
  });

  it("matches posting a job", () => {
    const m = matchQuestion("I want to post a job for my company");
    expect(m.entry?.id).toBe("post-a-job");
  });

  it("matches tracking an application", () => {
    const m = matchQuestion("How can I track my application status?");
    expect(m.entry?.id).toBe("track-application");
  });

  it("matches forgot password", () => {
    const m = matchQuestion("I forgot my password, help!");
    expect(m.entry?.id).toBe("forgot-password");
  });

  it("matches phone verification", () => {
    const m = matchQuestion("How do I verify my phone number?");
    expect(m.entry?.id).toBe("phone-verification");
  });

  it("matches ghost-job worries", () => {
    const m = matchQuestion("Are these jobs real or are some ghost jobs?");
    expect(m.entry?.id).toBe("ghost-jobs");
  });

  it("matches a greeting", () => {
    const m = matchQuestion("Hello!");
    expect(m.entry?.id).toBe("greeting");
  });

  it("falls back politely for unrelated questions", () => {
    const m = matchQuestion("What is the weather in Karachi today?");
    expect(m.isFallback).toBe(true);
    expect(m.entry).toBeNull();
    expect(m.fallbackLinks.map((l) => l.href)).toContain("/faq");
    expect(m.fallbackLinks.map((l) => l.href)).toContain("/contact");
  });

  it("falls back for empty input", () => {
    expect(matchQuestion("").isFallback).toBe(true);
    expect(matchQuestion("   ").isFallback).toBe(true);
  });

  it("all quick-reply suggestions resolve to a knowledge entry", () => {
    for (const s of CHAT_SUGGESTIONS) {
      const m = matchQuestion(s);
      expect(m.isFallback, `suggestion "${s}" should match an entry`).toBe(false);
    }
  });

  it("normalizes punctuation and case", () => {
    expect(normalizeQuestion("  How DO I Apply?! ")).toBe("how do i apply");
  });

  it("matches a question about the community feed", () => {
    const m = matchQuestion("What is the community feed?");
    expect(m.isFallback).toBe(false);
    expect(m.entry?.id).toBe("community-feed");
    expect(m.entry?.links?.map((l) => l.href)).toContain("/feed");
  });

  it("matches how to post an update", () => {
    const m = matchQuestion("How can I post an update to the feed?");
    expect(m.entry?.id).toBe("post-to-feed");
  });

  it("matches sharing a job on the feed", () => {
    const m = matchQuestion("Can I share a job on the feed?");
    expect(m.entry?.id).toBe("post-to-feed");
  });

  it("matches liking and commenting", () => {
    const m = matchQuestion("How do I like a post and comment on a post?");
    expect(m.entry?.id).toBe("like-comment");
  });

  it("matches making a profile public", () => {
    const m = matchQuestion("How do I make my profile public?");
    expect(m.entry?.id).toBe("public-profile");
    expect(m.entry?.links?.map((l) => l.href)).toContain("/candidate/profile");
  });

  it("does not let the word 'like' hijack job questions", () => {
    const m = matchQuestion("I would like to apply for a job");
    expect(m.entry?.id).toBe("apply-for-job");
  });
});
