import { describe, expect, it } from "vitest";
import {
  InvalidTransitionError,
  allowedNextStages,
  assertValidTransition,
  isTerminalStage,
  isValidTransition,
  type PipelineStage,
  type PipelineTransition,
} from "@/lib/pipeline";

// Mirrors the seeded data in supabase/migrations/0009_seed.sql (subset).
const stages: PipelineStage[] = [
  { id: "s1", key: "applied", label: "Applied", sort_order: 1, is_terminal: false },
  { id: "s2", key: "initial_screening", label: "Initial Screening", sort_order: 2, is_terminal: false },
  { id: "s3", key: "shortlisted", label: "Shortlisted", sort_order: 3, is_terminal: false },
  { id: "s4", key: "rejected", label: "Rejected", sort_order: 12, is_terminal: true },
  { id: "s5", key: "withdrawn", label: "Withdrawn", sort_order: 13, is_terminal: true },
  { id: "s6", key: "hired", label: "Hired", sort_order: 11, is_terminal: true },
];

const transitions: PipelineTransition[] = [
  { from_stage: "s1", to_stage: "s2", from_key: "applied", to_key: "initial_screening" },
  { from_stage: "s2", to_stage: "s3", from_key: "initial_screening", to_key: "shortlisted" },
  { from_stage: "s1", to_stage: "s4", from_key: "applied", to_key: "rejected" },
  { from_stage: "s2", to_stage: "s5", from_key: "initial_screening", to_key: "withdrawn" },
];

describe("isValidTransition", () => {
  it("allows transitions present in the transition table", () => {
    expect(isValidTransition("applied", "initial_screening", stages, transitions)).toBe(true);
  });

  it("rejects transitions not in the table", () => {
    expect(isValidTransition("applied", "shortlisted", stages, transitions)).toBe(false);
  });

  it("rejects any transition out of a terminal stage", () => {
    expect(isValidTransition("rejected", "applied", stages, transitions)).toBe(false);
    expect(isValidTransition("hired", "withdrawn", stages, transitions)).toBe(false);
  });

  it("treats no-op updates as valid", () => {
    expect(isValidTransition("applied", "applied", stages, transitions)).toBe(true);
  });
});

describe("allowedNextStages", () => {
  it("lists reachable stages", () => {
    expect(allowedNextStages("applied", transitions).sort()).toEqual([
      "initial_screening",
      "rejected",
    ]);
    expect(allowedNextStages("hired", transitions)).toEqual([]);
  });
});

describe("isTerminalStage", () => {
  it("identifies terminal stages", () => {
    expect(isTerminalStage("rejected", stages)).toBe(true);
    expect(isTerminalStage("applied", stages)).toBe(false);
  });
});

describe("assertValidTransition", () => {
  it("throws InvalidTransitionError for illegal moves", () => {
    expect(() => assertValidTransition("applied", "shortlisted", stages, transitions)).toThrow(
      InvalidTransitionError,
    );
  });

  it("does not throw for legal moves", () => {
    expect(() =>
      assertValidTransition("applied", "initial_screening", stages, transitions),
    ).not.toThrow();
  });
});
