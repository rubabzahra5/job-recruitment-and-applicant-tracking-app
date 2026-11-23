"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { createNotification } from "@/lib/notifications";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractJobId, scamReportSchema } from "./_schemas";

export type ScamReportResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string>;
      /** True when migration 0019 has not run yet — the form shows a
       * "being set up" notice pointing at the contact page instead of a
       * generic failure. */
      setupPending?: boolean;
    };

const SETUP_MESSAGE =
  "Scam reporting is still being set up. Please use our contact page meanwhile — we take every report seriously.";

/** PostgREST/Postgres signals that the scam_reports table is not there yet. */
function isMissingTable(error: { code?: string; message?: string }): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("scam_reports") && (msg.includes("does not exist") || msg.includes("not find"));
}

/**
 * Persist a public scam report (migration 0019).
 *
 * - Validates with Zod (same schema as the client form).
 * - Rate-limited per IP (bucket "scam_report", 5/hour) BEFORE inserting —
 *   the form is anonymous, so this is the abuse brake (SEC-10 pattern).
 * - Inserts via the service-role client: scam_reports has RLS enabled
 *   with NO anon/authenticated policies by design.
 * - The reporter IP is stored only as a SHA-256 hash (ip_hash).
 * - FAIL-SOFT: until migration 0019 runs, returns a friendly
 *   "being set up" result instead of an error (the feed pattern).
 * - Super-admin notification is best-effort, like the contact form.
 */
export async function submitScamReport(input: unknown): Promise<ScamReportResult> {
  const parsed = scamReportSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields and try again.", fieldErrors };
  }

  const ip = getClientIp(await headers());
  const { allowed, retryAfterSec } = await checkRateLimit("scam_report", ip, 5, 3600);
  if (!allowed) {
    return {
      ok: false,
      error: `Too many reports from this connection. Please try again in ${retryAfterSec} seconds.`,
    };
  }

  const admin = createAdminClient();
  const data = parsed.data;
  /** Browser forms submit "" for untouched optional fields — store null. */
  const orNull = (v: string | undefined) => (v && v.length > 0 ? v : null);

  // Resolve a job reference if the reporter pasted a link/ID containing a
  // UUID — but only keep the FK if that job actually exists (a wrong FK
  // would fail the insert; the raw text is preserved in job_url either way).
  let jobId: string | null = null;
  const candidateJobId = extractJobId(data.jobLink);
  if (candidateJobId) {
    const { data: job, error: jobError } = await admin
      .from("jobs")
      .select("id")
      .eq("id", candidateJobId)
      .maybeSingle();
    if (!jobError && job) jobId = candidateJobId;
  }

  const { error } = await admin.from("scam_reports").insert({
    reporter_name: orNull(data.reporterName),
    reporter_email: orNull(data.reporterEmail),
    job_id: jobId,
    job_url: orNull(data.jobLink),
    organization_name: orNull(data.organizationName),
    scam_type: data.scamType,
    description: data.description,
    evidence_urls: orNull(data.evidenceUrls),
    ip_hash: createHash("sha256").update(ip).digest("hex"),
  });
  if (error) {
    if (isMissingTable(error)) {
      return { ok: false, error: SETUP_MESSAGE, setupPending: true };
    }
    console.error("[scam-report] insert failed:", error.message);
    return { ok: false, error: "We couldn't save your report right now. Please try again later." };
  }

  try {
    const { data: admins } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin")
      .is("org_id", null);
    for (const row of admins ?? []) {
      await createNotification({
        userId: row.user_id as string,
        type: "scam_report",
        title: `New scam report: ${data.scamType.replace(/_/g, " ")}`,
        body: data.organizationName
          ? `Organisation named: ${data.organizationName}`
          : "No organisation named — see the report for details.",
        link: "/control-center/scam-reports",
      });
    }
  } catch {
    // Best-effort: the report is already stored; never fail the submission.
  }

  return { ok: true };
}
