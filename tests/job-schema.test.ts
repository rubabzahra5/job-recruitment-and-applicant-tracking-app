import { describe, expect, it } from "vitest";
import {
  JOB_TRANSITIONS,
  jobPayloadSchema,
} from "@/app/(employer)/employer/jobs/job-schema";

/** Minimal fully-valid job payload for the schema under test. */
function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "Senior React Developer",
    departmentId: null,
    categoryId: null,
    locationId: null,
    description:
      "We are hiring a senior React developer for our Karachi office. You will build our ATS product.",
    responsibilities: null,
    qualifications: null,
    skills: ["React", "TypeScript"],
    experienceMin: 3,
    experienceMax: 5,
    educationLevel: null,
    employmentType: "full_time",
    workplace: "on_site",
    salaryMin: 150000,
    salaryMax: 250000,
    salaryPeriod: "monthly",
    salaryDisclosed: true,
    openings: 2,
    isFreshGraduateOk: false,
    deadline: null,
    benefits: "",
    instructions: "",
    questions: [],
    ...overrides,
  };
}

describe("jobPayloadSchema — salary range (min <= max)", () => {
  it("accepts a valid min/max pair", () => {
    const r = jobPayloadSchema.safeParse(validPayload());
    expect(r.success).toBe(true);
  });

  it("accepts equal min and max", () => {
    const r = jobPayloadSchema.safeParse(
      validPayload({ salaryMin: 200000, salaryMax: 200000 }),
    );
    expect(r.success).toBe(true);
  });

  it("accepts open-ended ranges (one side null)", () => {
    expect(jobPayloadSchema.safeParse(validPayload({ salaryMin: null })).success).toBe(true);
    expect(jobPayloadSchema.safeParse(validPayload({ salaryMax: null })).success).toBe(true);
    expect(
      jobPayloadSchema.safeParse(validPayload({ salaryMin: null, salaryMax: null })).success,
    ).toBe(true);
  });

  it("rejects max < min with the documented message on salaryMax", () => {
    const r = jobPayloadSchema.safeParse(
      validPayload({ salaryMin: 250000, salaryMax: 150000 }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.join(".") === "salaryMax");
      expect(issue).toBeDefined();
      expect(issue!.message).toMatch(/greater than or equal to minimum salary/i);
    }
  });

  it("rejects negative salaries", () => {
    const r = jobPayloadSchema.safeParse(validPayload({ salaryMin: -1000 }));
    expect(r.success).toBe(false);
  });

  it("rejects max < min even when min is 0", () => {
    // max is still >= 0 individually, but violates min<=max
    const r = jobPayloadSchema.safeParse(validPayload({ salaryMin: 1, salaryMax: 0 }));
    expect(r.success).toBe(false);
  });
});

describe("jobPayloadSchema — experience range", () => {
  it("rejects experienceMax < experienceMin", () => {
    const r = jobPayloadSchema.safeParse(
      validPayload({ experienceMin: 5, experienceMax: 2 }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.join(".") === "experienceMax")).toBe(true);
    }
  });
});

describe("JOB_TRANSITIONS — job lifecycle map", () => {
  it("allows the moderation path draft → pending_review → approved → published", () => {
    expect(JOB_TRANSITIONS.draft).toContain("pending_review");
    expect(JOB_TRANSITIONS.pending_review).toContain("approved");
    expect(JOB_TRANSITIONS.approved).toContain("published");
  });

  it("locks published jobs out of draft", () => {
    expect(JOB_TRANSITIONS.published).not.toContain("draft");
    expect(JOB_TRANSITIONS.published).toEqual(
      expect.arrayContaining(["paused", "closed"]),
    );
  });

  it("makes archived a sink with no outgoing transitions", () => {
    expect(JOB_TRANSITIONS.archived).toEqual([]);
  });

  it("allows closed → archived but not closed → published", () => {
    expect(JOB_TRANSITIONS.closed).toContain("archived");
    expect(JOB_TRANSITIONS.closed).not.toContain("published");
  });
});
