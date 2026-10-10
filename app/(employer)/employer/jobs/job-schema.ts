import { z } from "zod";

/**
 * Shared job payload schema (client form + server actions).
 * Numbers arrive already normalized (null when empty); the DB CHECK
 * salary_max >= salary_min is additionally enforced by this refine.
 */

export const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "contract",
  "temporary",
  "internship",
  "apprenticeship",
  "freelance",
] as const;

export const WORKPLACES = ["on_site", "hybrid", "remote"] as const;
export const SALARY_PERIODS = ["monthly", "annual", "hourly", "project"] as const;

export const jobPayloadSchema = z
  .object({
    title: z.string().trim().min(3, "Title must be at least 3 characters.").max(200),
    departmentId: z.string().uuid().nullable(),
    categoryId: z.string().uuid().nullable(),
    locationId: z.string().uuid().nullable(),
    description: z.string().trim().min(20, "Description must be at least 20 characters."),
    responsibilities: z.string().trim().nullable(),
    qualifications: z.string().trim().nullable(),
    skills: z.array(z.string().trim().min(1)).max(50).default([]),
    experienceMin: z.number().min(0).max(60).nullable(),
    experienceMax: z.number().min(0).max(60).nullable(),
    educationLevel: z.string().trim().max(120).nullable(),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    workplace: z.enum(WORKPLACES),
    salaryMin: z.number().min(0).nullable(),
    salaryMax: z.number().min(0).nullable(),
    salaryPeriod: z.enum(SALARY_PERIODS),
    salaryDisclosed: z.boolean(),
    openings: z.number().int().min(1).max(10000),
    isFreshGraduateOk: z.boolean(),
    deadline: z.string().nullable(), // "YYYY-MM-DDTHH:mm" Asia/Karachi wall clock
    benefits: z.string().trim().default(""),
    instructions: z.string().trim().default(""),
    questions: z
      .array(
        z.object({
          question: z.string().trim().min(1).max(500),
          isRequired: z.boolean(),
        }),
      )
      .max(20)
      .default([]),
  })
  .refine((d) => d.salaryMin === null || d.salaryMax === null || d.salaryMax >= d.salaryMin, {
    message: "Maximum salary must be greater than or equal to minimum salary.",
    path: ["salaryMax"],
  })
  .refine(
    (d) => d.experienceMin === null || d.experienceMax === null || d.experienceMax >= d.experienceMin,
    {
      message: "Maximum experience must be greater than or equal to minimum experience.",
      path: ["experienceMax"],
    },
  );

export type JobPayload = z.infer<typeof jobPayloadSchema>;

/** Job status workflow (server-enforced in actions.ts). */
export const JOB_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending_review", "published", "archived"],
  pending_review: ["approved", "rejected", "draft"],
  approved: ["published", "draft"],
  rejected: ["draft", "archived"],
  published: ["paused", "closed"],
  paused: ["published", "closed"],
  closed: ["archived"],
  archived: [],
};

export const JOB_ACTION_LABELS: Record<string, string> = {
  pending_review: "Submit for review",
  approved: "Approve",
  rejected: "Reject",
  published: "Publish",
  paused: "Pause",
  closed: "Close",
  archived: "Archive",
  draft: "Move back to draft",
};

export function assertJobTransition(from: string, to: string): void {
  const allowed = JOB_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid job status transition: "${from}" → "${to}".`);
  }
}
