import { z } from "zod";

/**
 * Zod schema for the public scam-report form (app/(public)/report-scam).
 * Plain TS: imported by the client form, the server action AND unit tests.
 * Field limits mirror the scam_reports table (migration 0019); the
 * scam_type values mirror its CHECK constraint.
 *
 * Optional text fields accept an empty string (what a browser form
 * submits); the server action normalises "" to null before inserting.
 */

export const SCAM_TYPES = [
  { value: "money_asked", label: "They asked me for money (fees, deposit, training charges)" },
  { value: "fake_job", label: "The job does not seem to exist" },
  { value: "impersonation", label: "They are pretending to be another company" },
  { value: "phishing", label: "They asked for bank details, PINs or OTP codes" },
  { value: "other", label: "Something else suspicious" },
] as const;

export type ScamType = (typeof SCAM_TYPES)[number]["value"];

export const scamReportSchema = z.object({
  reporterName: z.string().trim().max(100, "Name is too long.").optional(),
  reporterEmail: z
    .string()
    .trim()
    .max(255, "Email is too long.")
    .optional()
    .refine(
      (v) => !v || z.string().email().safeParse(v).success,
      "Enter a valid email address.",
    ),
  /** A pasted job link, a job page URL, or a bare job ID — all optional. */
  jobLink: z.string().trim().max(500, "Job link is too long.").optional(),
  organizationName: z.string().trim().max(200, "Organisation name is too long.").optional(),
  scamType: z.enum(["money_asked", "fake_job", "impersonation", "phishing", "other"], {
    message: "Choose the type of scam.",
  }),
  description: z
    .string()
    .trim()
    .min(20, "Please describe what happened (at least 20 characters) so we can act on it.")
    .max(5000, "Description is too long."),
  evidenceUrls: z.string().trim().max(2000, "Evidence links are too long.").optional(),
});
export type ScamReportInput = z.infer<typeof scamReportSchema>;

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Extract a job UUID from whatever the reporter pasted: a bare UUID, or a
 * URL containing one. Returns null when there is no UUID to find (the raw
 * text is still stored in job_url so nothing is lost).
 */
export function extractJobId(text: string | undefined | null): string | null {
  if (!text) return null;
  const match = text.match(UUID_RE);
  return match ? match[0].toLowerCase() : null;
}
