import { describe, expect, it, vi } from "vitest";
import {
  InvalidTransitionError,
  allowedNextStages,
  assertValidTransition,
  isTerminalStage,
  isValidTransition,
  loadPipeline,
  type PipelineStage,
  type PipelineTransition,
} from "@/lib/pipeline";

/**
 * Full transition-matrix coverage for lib/pipeline.ts, mirroring the seeded
 * reference data (supabase/migrations/0009_seed.sql): 13 stages, 27 transitions.
 * Complements tests/pipeline.test.ts with the complete seed matrix.
 */

const STAGE_DEFS: Array<[key: string, label: string, sort: number, terminal: boolean]> = [
  ["applied", "Applied", 1, false],
  ["initial_screening", "Initial Screening", 2, false],
  ["shortlisted", "Shortlisted", 3, false],
  ["assessment", "Assessment", 4, false],
  ["interview_scheduled", "Interview Scheduled", 5, false],
  ["interview_completed", "Interview Completed", 6, false],
  ["reference_check", "Reference Check", 7, false],
  ["offer_pending", "Offer Pending", 8, false],
  ["offer_accepted", "Offer Accepted", 9, false],
  ["offer_declined", "Offer Declined", 10, true],
  ["hired", "Hired", 11, true],
  ["rejected", "Rejected", 12, true],
  ["withdrawn", "Withdrawn", 13, true],
];

const stages: PipelineStage[] = STAGE_DEFS.map(([key, label, sort_order, is_terminal], i) => ({
  id: `s${i + 1}`,
  key,
  label,
  sort_order,
  is_terminal,
}));

const TRANSITION_PAIRS: Array<[string, string]> = [
  // Happy path: applied → … → hired
  ["applied", "initial_screening"],
  ["initial_screening", "shortlisted"],
  ["shortlisted", "assessment"],
  ["assessment", "interview_scheduled"],
  ["interview_scheduled", "interview_completed"],
  ["interview_completed", "reference_check"],
  ["reference_check", "offer_pending"],
  ["offer_pending", "offer_accepted"],
  ["offer_accepted", "hired"],
  // Declined offer
  ["offer_pending", "offer_declined"],
  // Any non-terminal stage → rejected
  ["applied", "rejected"],
  ["initial_screening", "rejected"],
  ["shortlisted", "rejected"],
  ["assessment", "rejected"],
  ["interview_scheduled", "rejected"],
  ["interview_completed", "rejected"],
  ["reference_check", "rejected"],
  ["offer_pending", "rejected"],
  // Any non-terminal stage (+ accepted offer) → withdrawn
  ["applied", "withdrawn"],
  ["initial_screening", "withdrawn"],
  ["shortlisted", "withdrawn"],
  ["assessment", "withdrawn"],
  ["interview_scheduled", "withdrawn"],
  ["interview_completed", "withdrawn"],
  ["reference_check", "withdrawn"],
  ["offer_pending", "withdrawn"],
  ["offer_accepted", "withdrawn"],
];

const byKey = new Map(stages.map((s) => [s.key, s.id]));
const transitions: PipelineTransition[] = TRANSITION_PAIRS.map(([from, to]) => ({
  from_stage: byKey.get(from)!,
  to_stage: byKey.get(to)!,
  from_key: from,
  to_key: to,
}));

describe("pipeline matrix — happy path", () => {
  it("allows every step of applied → … → hired", () => {
    const path = [
      "applied",
      "initial_screening",
      "shortlisted",
      "assessment",
      "interview_scheduled",
      "interview_completed",
      "reference_check",
      "offer_pending",
      "offer_accepted",
      "hired",
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(isValidTransition(path[i]!, path[i + 1]!, stages, transitions)).toBe(true);
    }
  });

  it("allows offer_pending → offer_declined", () => {
    expect(isValidTransition("offer_pending", "offer_declined", stages, transitions)).toBe(true);
  });
});

describe("pipeline matrix — invalid jumps rejected", () => {
  it("rejects skipping stages on the happy path", () => {
    expect(isValidTransition("applied", "hired", stages, transitions)).toBe(false);
    expect(isValidTransition("applied", "shortlisted", stages, transitions)).toBe(false);
    expect(isValidTransition("initial_screening", "offer_pending", stages, transitions)).toBe(false);
    expect(isValidTransition("shortlisted", "hired", stages, transitions)).toBe(false);
  });

  it("rejects backwards moves", () => {
    expect(isValidTransition("shortlisted", "applied", stages, transitions)).toBe(false);
    expect(isValidTransition("hired", "offer_accepted", stages, transitions)).toBe(false);
  });

  it("rejects transitions to unknown stages", () => {
    expect(isValidTransition("applied", "no_such_stage", stages, transitions)).toBe(false);
  });
});

describe("pipeline matrix — terminal stages locked", () => {
  it.each(["hired", "rejected", "withdrawn", "offer_declined"])(
    "locks %s: no outgoing transitions",
    (terminal) => {
      for (const s of stages) {
        if (s.key !== terminal) {
          expect(isValidTransition(terminal, s.key, stages, transitions)).toBe(false);
        }
      }
      expect(allowedNextStages(terminal, transitions)).toEqual([]);
      expect(isTerminalStage(terminal, stages)).toBe(true);
    },
  );

  it("treats self-transitions on terminal stages as valid no-ops", () => {
    // isValidTransition short-circuits fromKey === toKey before the terminal check.
    expect(isValidTransition("hired", "hired", stages, transitions)).toBe(true);
  });
});

describe("pipeline matrix — candidate may only move to withdrawn", () => {
  // The transition table allows any non-terminal stage → withdrawn (plus
  // offer_accepted → withdrawn); the candidate portal additionally restricts
  // withdrawal to pre-offer stages — see the withdrawApplication tests.
  it("allows every non-terminal stage → withdrawn", () => {
    for (const s of stages.filter((s) => !s.is_terminal)) {
      expect(isValidTransition(s.key, "withdrawn", stages, transitions)).toBe(true);
    }
  });

  it("allows offer_accepted → withdrawn (employer-recorded withdrawal)", () => {
    expect(isValidTransition("offer_accepted", "withdrawn", stages, transitions)).toBe(true);
  });

  it("does not let a candidate jump anywhere else", () => {
    expect(isValidTransition("applied", "shortlisted", stages, transitions)).toBe(false);
    expect(isValidTransition("applied", "rejected", stages, transitions)).toBe(true); // employer move
  });
});

describe("assertValidTransition", () => {
  it("throws InvalidTransitionError naming both stages", () => {
    expect(() => assertValidTransition("applied", "hired", stages, transitions)).toThrow(
      InvalidTransitionError,
    );
    expect(() => assertValidTransition("applied", "hired", stages, transitions)).toThrow(
      /"applied" → "hired"/,
    );
  });
});

describe("loadPipeline", () => {
  it("maps loader rows to stages + keyed transitions", async () => {
    const loader = {
      from: vi.fn((table: string) => ({
        select: async (_cols: string) => {
          if (table === "pipeline_stages") {
            return {
              data: stages,
              error: null,
            };
          }
          return {
            data: TRANSITION_PAIRS.slice(0, 2).map(([from, to]) => ({
              from_stage: byKey.get(from),
              to_stage: byKey.get(to),
              from: { key: from },
              to: { key: to },
            })),
            error: null,
          };
        },
      })),
    };
    const { stages: gotStages, transitions: gotTransitions } = await loadPipeline(loader);
    expect(gotStages).toHaveLength(13);
    expect(gotTransitions[0]).toEqual({
      from_stage: byKey.get("applied"),
      to_stage: byKey.get("initial_screening"),
      from_key: "applied",
      to_key: "initial_screening",
    });
  });

  it("throws when the stages query fails", async () => {
    const loader = {
      from: () => ({
        select: async () => ({ data: null, error: { message: "db down" } }),
      }),
    };
    await expect(loadPipeline(loader)).rejects.toThrow(/Failed to load pipeline stages/);
  });
});
