import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeOrgResponseRate,
  fetchStatusHistoryByApplication,
  getFirstResponseAt,
  type ApplicationResponseInput,
  type StatusHistoryDb,
} from "@/lib/response-deadline";

export interface OrgResponsiveness {
  orgId: string;
  responseRate: number | null; // 0-100, null if no applications in window
  medianResponseHours: number | null;
  totalApplications: number;
  respondedApplications: number;
}

/**
 * Calculate an organization's responsiveness over the last N days.
 *
 * Response rate follows the shared 5–7 business-day rule
 * (lib/response-deadline.ts): only responses that arrived within the
 * 7-business-day deadline count, so late replies and ghosted applications
 * lower the rate. This powers the public "Responds to X% of applications"
 * badges — TalentBridge's answer to the ghost-job epidemic — and the same
 * helper feeds job cards, company pages and employer views, so the number
 * is identical everywhere.
 */
export async function getOrgResponsiveness(
  orgId: string,
  windowDays = 90,
): Promise<OrgResponsiveness> {
  const admin = createAdminClient();
  const windowStart = new Date(Date.now() - windowDays * 86400 * 1000).toISOString();

  const { data: apps, error } = await admin
    .from("applications")
    .select("id,stage,submitted_at,updated_at")
    .eq("org_id", orgId)
    .gte("submitted_at", windowStart);

  if (error || !apps || apps.length === 0) {
    return {
      orgId,
      responseRate: null,
      medianResponseHours: null,
      totalApplications: 0,
      respondedApplications: 0,
    };
  }

  // First responses come from the status history (authoritative); the
  // shared module falls back to stage/updated_at when history is missing.
  const historyByApp = await fetchStatusHistoryByApplication(
    admin as unknown as StatusHistoryDb,
    apps.map((a) => a.id as string),
  );

  const inputs: ApplicationResponseInput[] = apps.map((a) => ({
    stage: a.stage as string,
    submitted_at: a.submitted_at as string,
    updated_at: a.updated_at as string,
    statusHistory: historyByApp.get(a.id as string) ?? [],
  }));

  const rate = computeOrgResponseRate(inputs);

  // Median time from submission to first employer response.
  let medianResponseHours: number | null = null;
  const responseHours: number[] = [];
  for (const input of inputs) {
    const first = getFirstResponseAt(input);
    if (first) {
      const submitted = new Date(input.submitted_at).getTime();
      responseHours.push(Math.max(0, (first.getTime() - submitted) / 3600000));
    }
  }
  if (responseHours.length > 0) {
    const hours = responseHours.sort((x, y) => x - y);
    const mid = Math.floor(hours.length / 2);
    if (hours.length % 2 === 0) {
      const a = hours[mid - 1] ?? 0;
      const b = hours[mid] ?? 0;
      medianResponseHours = Math.round((a + b) / 2);
    } else {
      medianResponseHours = Math.round(hours[mid] ?? 0);
    }
  }

  return {
    orgId,
    responseRate: rate.responseRate,
    medianResponseHours,
    totalApplications: rate.totalApplications,
    respondedApplications: rate.responded,
  };
}

/**
 * Batch version for job listings — returns a map of orgId -> responsiveness.
 * Use on public job pages to avoid N+1 queries.
 */
export async function getOrgsResponsiveness(
  orgIds: string[],
  windowDays = 90,
): Promise<Map<string, OrgResponsiveness>> {
  const map = new Map<string, OrgResponsiveness>();
  // Batch in groups of 10 to avoid overwhelming the DB.
  for (let i = 0; i < orgIds.length; i += 10) {
    const batch = orgIds.slice(i, i + 10);
    const results = await Promise.all(batch.map((id) => getOrgResponsiveness(id, windowDays)));
    for (const r of results) map.set(r.orgId, r);
  }
  return map;
}

/**
 * Format a response rate for public display.
 * Returns null when there's insufficient data (don't show a badge).
 */
export function formatResponseBadge(r: OrgResponsiveness): string | null {
  if (r.responseRate === null || r.totalApplications < 5) return null;
  return `Responds to ${r.responseRate}% of applications`;
}
