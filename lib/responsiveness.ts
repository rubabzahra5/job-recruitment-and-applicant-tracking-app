import { createAdminClient } from "@/lib/supabase/admin";

export interface OrgResponsiveness {
  orgId: string;
  responseRate: number | null; // 0-100, null if no applications in window
  medianResponseHours: number | null;
  totalApplications: number;
  respondedApplications: number;
}

/**
 * Calculate an organization's responsiveness over the last N days.
 * responseRate = % of applications that moved beyond 'applied' stage.
 * This powers the public "Responds to X% of applications" badges —
 * TalentBridge's answer to the ghost-job epidemic.
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

  const total = apps.length;
  const responded = apps.filter((a) => (a.stage as string) !== "applied");
  const respondedCount = responded.length;
  const responseRate = total > 0 ? Math.round((respondedCount / total) * 100) : null;

  // Median time from submitted_at to first stage change (updated_at as proxy).
  let medianResponseHours: number | null = null;
  if (respondedCount > 0) {
    const hours = responded
      .map((a) => {
        const submitted = new Date(a.submitted_at as string).getTime();
        const updated = new Date(a.updated_at as string).getTime();
        return Math.max(0, (updated - submitted) / 3600000);
      })
      .sort((x, y) => x - y);
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
    responseRate,
    medianResponseHours,
    totalApplications: total,
    respondedApplications: respondedCount,
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
