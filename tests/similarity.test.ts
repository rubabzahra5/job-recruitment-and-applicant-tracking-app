import { describe, expect, it } from "vitest";
import { jaccardSimilarity, checkSimilarity, similarityLabel } from "@/lib/similarity";

describe("cover-letter similarity detection", () => {
  it("returns 1 for identical texts", () => {
    const text = "I am excited to apply for this software engineer position at your company.";
    expect(jaccardSimilarity(text, text)).toBe(1);
  });

  it("returns 0 for completely different texts", () => {
    const t1 = "I love programming in Python and building web applications.";
    const t2 = "The weather in Karachi is very hot during the summer months.";
    expect(jaccardSimilarity(t1, t2)).toBeLessThan(0.1);
  });

  it("detects high similarity in template letters", () => {
    const template = "Dear hiring manager, I am writing to apply for the position. I have five years of experience. Thank you for your consideration.";
    const slightlyModified = "Dear hiring manager, I am writing to apply for the role. I have five years of experience. Thank you for your consideration.";
    const sim = jaccardSimilarity(template, slightlyModified);
    expect(sim).toBeGreaterThan(0.5);
  });

  it("handles empty inputs", () => {
    expect(jaccardSimilarity("", "some text")).toBe(0);
    expect(jaccardSimilarity("some text", "")).toBe(0);
  });

  it("checkSimilarity finds the most similar previous letter", () => {
    const newLetter = "I am a software engineer with React experience seeking opportunities.";
    const previous = [
      { applicationId: "app1", coverLetter: "Completely different text about marketing and sales experience." },
      { applicationId: "app2", coverLetter: "I am a software engineer with React experience looking for new challenges." },
    ];
    const result = checkSimilarity(newLetter, previous);
    expect(result.matchedApplicationId).toBe("app2");
    expect(result.maxSimilarity).toBeGreaterThan(0.3);
  });

  it("similarityLabel returns correct tones", () => {
    expect(similarityLabel(0.9).tone).toBe("danger");
    expect(similarityLabel(0.6).tone).toBe("warning");
    expect(similarityLabel(0.1).tone).toBe("success");
  });
});
