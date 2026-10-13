import "server-only";

import { revalidatePath } from "next/cache";
import { requireSessionUser, type SessionUser } from "@/lib/auth";
import {
  getUserOrgIds,
  isSuperAdmin,
  requireOrgRole,
  AuthorizationError,
  type OrgRole,
} from "@/lib/rbac";

export type { OrgRole };
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { loadPipeline, assertValidTransition, type PipelineLoader } from "@/lib/pipeline";

/**
 * Shared employer-portal server helpers.
 *
 * Tenant isolation contract (every page/action in (employer) follows this):
 *  1. requireSessionUser() — who is calling.
 *  2. getOrgContext() — resolves the org from the user's ACTIVE memberships
 *     (never trusts a raw client org_id; the ?org= param is validated against
 *     memberships before use).
 *  3. requireOrgRole(user.id, orgId, …) — DB-backed role check per action.
 *  4. Every query is additionally scoped by org_id, and resource actions
 *     re-verify row.org_id === ctx.orgId (defense in depth).
 */

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

export interface OrgContext {
  user: SessionUser;
  orgId: string;
  role: OrgRole;
  org: OrgSummary;
  /** All orgs the user belongs to (for the switcher). */
  orgs: { id: string; name: string }[];
  isSuperAdmin: boolean;
}

export class NoOrganizationError extends Error {
  constructor(message = "No organization membership found.") {
    super(message);
    this.name = "NoOrganizationError";
  }
}

/**
 * Resolve the caller's org context. `requestedOrgId` (from ?org=) is accepted
 * only when the user has an active membership in that org (super admins may
 * pass any existing org id explicitly).
 */
export async function getOrgContext(requestedOrgId?: string | null): Promise<OrgContext> {
  const user = await requireSessionUser();
  const admin = createAdminClient();
  const superAdmin = await isSuperAdmin(user.id);

  const orgIds = await getUserOrgIds(user.id);

  let orgId: string | null = null;
  if (requestedOrgId && orgIds.includes(requestedOrgId)) {
    orgId = requestedOrgId;
  } else if (requestedOrgId && superAdmin) {
    const { data } = await admin
      .from("organizations")
      .select("id")
      .eq("id", requestedOrgId)
      .maybeSingle();
    if (data) orgId = requestedOrgId;
  }
  if (!orgId) orgId = orgIds[0] ?? null;
  if (!orgId) throw new NoOrganizationError();

  const role = await requireOrgRole(user.id, orgId, { atLeast: "employee" });

  const [{ data: org }, { data: memberships }] = await Promise.all([
    admin
      .from("organizations")
      .select("id,name,slug,logo_url,account_status")
      .eq("id", orgId)
      .single(),
    admin.from("organization_memberships").select("org_id").eq("user_id", user.id).eq("is_active", true),
  ]);
  if (!org) throw new NoOrganizationError();
  // SECURITY (M4): Suspended/closed orgs are inaccessible to staff.
  // Super-admins can still access for audit/investigation.
  const accountStatus = (org as { account_status?: string }).account_status;
  if (accountStatus !== "active" && !superAdmin) {
    throw new NoOrganizationError(
      accountStatus === "suspended"
        ? "This organization has been suspended. Contact platform support."
        : "This organization is no longer active.",
    );
  }

  const orgNameById = new Map<string, string>();
  if (memberships && memberships.length > 0) {
    const { data: orgRows } = await admin
      .from("organizations")
      .select("id,name")
      .in("id", memberships.map((m) => m.org_id));
    for (const r of orgRows ?? []) orgNameById.set(r.id, r.name);
  }
  const orgs = (memberships ?? []).map((m) => ({
    id: m.org_id as string,
    name: orgNameById.get(m.org_id as string) ?? "Organization",
  }));

  return {
    user,
    orgId,
    role,
    org: org as OrgSummary,
    orgs,
    isSuperAdmin: superAdmin,
  };
}

/** Standard action result shape. */
export type ActionResult = { ok: true } | { ok: false; error: string };

export function okResult(): ActionResult {
  return { ok: true };
}

export function failResult(error: unknown): ActionResult {
  if (error instanceof AuthorizationError) {
    return { ok: false, error: "Not authorized for this action." };
  }
  return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
}

/** Revalidate the employer section after a mutation. */
export function revalidateEmployer() {
  revalidatePath("/employer", "layout");
}

// ─── settings ───────────────────────────────────────────────────────────────

export interface OrgSettings {
  max_active_job_postings: number | null;
  default_deadline_days: number | null;
  notify_recruiters_on_new_application: boolean;
  locations: string[];
}

const DEFAULT_ORG_SETTINGS: OrgSettings = {
  max_active_job_postings: null,
  default_deadline_days: 30,
  notify_recruiters_on_new_application: true,
  locations: [],
};

/**
 * Load organization_settings for an org (merged over defaults).
 * Settings contract (also consumed by the candidate module — see MODULE_SUMMARY_C.md):
 *  - max_active_job_postings: enforced when publishing jobs (this module).
 *  - default_deadline_days: pre-fills the deadline in the job form (this module).
 *  - notify_recruiters_on_new_application: candidate module should notify org
 *    recruiters when a new application arrives.
 *  - locations: office locations shown on the org profile page.
 */
export async function getOrgSettings(orgId: string): Promise<OrgSettings> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("organization_settings")
    .select("settings")
    .eq("org_id", orgId)
    .maybeSingle();
  const raw = (data?.settings ?? {}) as Partial<OrgSettings>;
  return {
    max_active_job_postings:
      typeof raw.max_active_job_postings === "number" ? raw.max_active_job_postings : null,
    default_deadline_days:
      typeof raw.default_deadline_days === "number" ? raw.default_deadline_days : 30,
    notify_recruiters_on_new_application: raw.notify_recruiters_on_new_application !== false,
    locations: Array.isArray(raw.locations) ? raw.locations.filter((l) => typeof l === "string") : [],
  };
}

export async function getPlatformSetting<T>(key: string, fallback: T): Promise<T> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (data?.value === undefined || data?.value === null) return fallback;
  return data.value as T;
}

// ─── role helpers ───────────────────────────────────────────────────────────

/** Salary amounts are visible only to org_admin and hr_manager. */
export function canViewSalary(role: OrgRole): boolean {
  return role === "org_admin" || role === "hr_manager";
}

/** Scoped application ids for hiring_manager ("assigned vacancies" only). */
export async function getAssignedApplicationIds(userId: string): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("application_assignments")
    .select("application_id")
    .eq("assignee_user_id", userId);
  return new Set((data ?? []).map((r) => r.application_id as string));
}

// ─── stage transitions ──────────────────────────────────────────────────────

export interface StageChangeInput {
  applicationId: string;
  orgId: string;
  fromStage: string;
  toStage: string;
  changedBy: string;
  reason?: string | null;
}

/**
 * Validate + apply a pipeline stage transition, writing the status-history row
 * and the audit log. The DB trigger enforces the same rules for direct SQL.
 */
export async function applyStageTransition(input: StageChangeInput): Promise<void> {
  const admin = createAdminClient();
  // The Supabase query builder is thenable but not typed as Promise — the
  // runtime awaits it fine; cast only for the PipelineLoader interface.
  const pipeline = await loadPipeline(admin as unknown as PipelineLoader);
  assertValidTransition(input.fromStage, input.toStage, pipeline.stages, pipeline.transitions);

  const { error: updateError } = await admin
    .from("applications")
    .update({ stage: input.toStage })
    .eq("id", input.applicationId)
    .eq("org_id", input.orgId);
  if (updateError) throw new Error(`Failed to update stage: ${updateError.message}`);

  // H2: Track employer activity for ghost-job accountability.
  // Update the job's last_employer_activity_at so stale postings can be
  // identified and auto-paused.
  const { data: app } = await admin
    .from("applications")
    .select("job_id")
    .eq("id", input.applicationId)
    .maybeSingle();
  if (app?.job_id) {
    await admin
      .from("jobs")
      .update({ last_employer_activity_at: new Date().toISOString() })
      .eq("id", app.job_id as string);
  }

  const { error: historyError } = await admin.from("application_status_history").insert({
    application_id: input.applicationId,
    from_stage: input.fromStage,
    to_stage: input.toStage,
    changed_by: input.changedBy,
    reason: input.reason ?? null,
  });
  if (historyError) throw new Error(`Failed to write status history: ${historyError.message}`);

  await writeAudit({
    actorUserId: input.changedBy,
    action: "application.stage_changed",
    entityType: "application",
    entityId: input.applicationId,
    orgId: input.orgId,
    metadata: { from: input.fromStage, to: input.toStage, reason: input.reason ?? null },
  });
}

/** Load an application and verify it belongs to the org (tenant isolation). */
export async function getOrgApplication(admin: ReturnType<typeof createAdminClient>, applicationId: string, orgId: string) {
  const { data, error } = await admin
    .from("applications")
    .select("id,user_id,job_id,org_id,stage,cover_letter,submitted_at,withdrawn_at,document_id")
    .eq("id", applicationId)
    .eq("org_id", orgId)
    .single();
  if (error || !data) throw new Error("Application not found in this organization.");
  return data;
}

/** Load a job and verify it belongs to the org (tenant isolation). */
export async function getOrgJob(admin: ReturnType<typeof createAdminClient>, jobId: string, orgId: string) {
  const { data, error } = await admin
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .eq("org_id", orgId)
    .single();
  if (error || !data) throw new Error("Job not found in this organization.");
  return data;
}

/** Supabase types to-one relations as arrays in some spots; normalize to one row. */
export function singleRow<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Org staff directory: memberships + effective roles + profile names. */
export interface OrgMember {
  userId: string;
  email: string;
  displayName: string | null;
  role: OrgRole | null;
  departmentId: string | null;
  departmentName: string | null;
  title: string | null;
  isActive: boolean;
}

export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  const admin = createAdminClient();
  const { data: memberships, error } = await admin
    .from("organization_memberships")
    .select("user_id,department_id,title,is_active,departments(name)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to list members: ${error.message}`);

  const userIds = (memberships ?? []).map((m) => m.user_id as string);
  const [{ data: profiles }, { data: roles }, { data: departments }] = await Promise.all([
    userIds.length > 0
      ? admin.from("profiles").select("id,email,display_name").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; email: string; display_name: string | null }[] }),
    userIds.length > 0
      ? admin.from("user_roles").select("user_id,role").eq("org_id", orgId).in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string; role: string }[] }),
    admin.from("departments").select("id,name").eq("org_id", orgId),
  ]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const roleByUser = new Map<string, OrgRole>();
  const rank: Record<string, number> = { employee: 1, hiring_manager: 2, recruiter: 3, hr_manager: 4, org_admin: 5 };
  for (const r of roles ?? []) {
    const cur = roleByUser.get(r.user_id as string);
    const cand = r.role as OrgRole;
    if (!cur || (rank[cand] ?? 0) > (rank[cur] ?? 0)) roleByUser.set(r.user_id as string, cand);
  }
  const deptById = new Map((departments ?? []).map((d) => [d.id as string, d.name as string]));

  return (memberships ?? []).map((m) => {
    const p = profileById.get(m.user_id as string);
    const dept = singleRow(m.departments as { name: string } | { name: string }[] | null);
    return {
      userId: m.user_id as string,
      email: (p?.email as string) ?? "",
      displayName: (p?.display_name as string | null) ?? null,
      role: roleByUser.get(m.user_id as string) ?? null,
      departmentId: (m.department_id as string | null) ?? null,
      departmentName: dept?.name ?? (m.department_id ? deptById.get(m.department_id as string) ?? null : null),
      title: (m.title as string | null) ?? null,
      isActive: (m.is_active as boolean) ?? false,
    };
  });
}
