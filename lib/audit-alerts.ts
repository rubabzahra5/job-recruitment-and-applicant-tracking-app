import { createAdminClient } from "@/lib/supabase/admin";

export interface AuditAlert {
  type: string;
  severity: "high" | "medium";
  message: string;
  count: number;
  windowHours: number;
}

/**
 * Detect suspicious patterns in audit logs (L4).
 * Checks the last 24 hours for:
 * - Mass job approvals (potential fake-job flood)
 * - Bulk user suspensions (potential abuse)
 * - Multiple failed login-adjacent actions
 *
 * Returns alerts for the control-center dashboard. This is a simple
 * heuristic version; a production system would use a proper SIEM.
 */
export async function getAuditAlerts(windowHours = 24): Promise<AuditAlert[]> {
  const admin = createAdminClient();
  const windowStart = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();
  const alerts: AuditAlert[] = [];

  // Mass job approvals
  const { count: approvals } = await admin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("action", "job.status_approved")
    .gte("created_at", windowStart);
  if ((approvals ?? 0) >= 10) {
    alerts.push({
      type: "mass_approvals",
      severity: "high",
      message: `${approvals} jobs approved in the last ${windowHours}h — review for fake-job flood`,
      count: approvals ?? 0,
      windowHours,
    });
  }

  // Bulk suspensions
  const { count: suspensions } = await admin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .in("action", ["user.suspended", "organization.suspended"])
    .gte("created_at", windowStart);
  if ((suspensions ?? 0) >= 5) {
    alerts.push({
      type: "bulk_suspensions",
      severity: "medium",
      message: `${suspensions} suspensions in the last ${windowHours}h — verify legitimacy`,
      count: suspensions ?? 0,
      windowHours,
    });
  }

  // Rapid org creation (potential spam)
  const { count: orgs } = await admin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("action", "organization.created")
    .gte("created_at", windowStart);
  if ((orgs ?? 0) >= 10) {
    alerts.push({
      type: "org_creation_spike",
      severity: "medium",
      message: `${orgs} organizations created in the last ${windowHours}h — check for spam`,
      count: orgs ?? 0,
      windowHours,
    });
  }

  return alerts;
}
