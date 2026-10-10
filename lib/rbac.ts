import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-side role-based access control.
 *
 * Source of truth is the `user_roles` table, always read here with the
 * service-role client and joined against active `organization_memberships`.
 * NEVER trust role claims from client input, cookies, or request bodies —
 * every page and server action must call these helpers.
 *
 * Role model:
 * - super_admin: platform-wide, org_id IS NULL
 * - candidate: platform-wide job seeker, org_id IS NULL
 * - org_admin | hr_manager | recruiter | hiring_manager | employee:
 *   scoped to one organization via org_id, and only effective while the
 *   organization_memberships row for (org_id, user_id) is active.
 */

export type OrgRole =
  | "org_admin"
  | "hr_manager"
  | "recruiter"
  | "hiring_manager"
  | "employee";

export type GlobalRole = "super_admin" | "candidate";

export interface UserRoleRow {
  role: string;
  orgId: string | null;
}

/** Higher number = more privilege. Used for "at least" checks. */
const ROLE_RANK: Record<OrgRole, number> = {
  employee: 1,
  hiring_manager: 2,
  recruiter: 3,
  hr_manager: 4,
  org_admin: 5,
};

export class AuthorizationError extends Error {
  constructor(message = "Not authorized.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

function isOrgRole(role: string): role is OrgRole {
  return role in ROLE_RANK;
}

/** All role grants for a user, straight from the user_roles table. */
export async function getUserRoles(userId: string): Promise<UserRoleRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_roles")
    .select("role, org_id")
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to load user roles: ${error.message}`);
  return (data ?? []).map((r) => ({ role: r.role, orgId: r.org_id }));
}

export async function isSuperAdmin(userId: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.some((r) => r.role === "super_admin" && r.orgId === null);
}

export async function isCandidate(userId: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.some((r) => r.role === "candidate" && r.orgId === null);
}

/**
 * The user's effective role in an organization, or null.
 * Requires BOTH a user_roles grant AND an active organization_memberships row.
 */
export async function getUserOrgRole(
  userId: string,
  orgId: string,
): Promise<OrgRole | null> {
  const admin = createAdminClient();
  const [{ data: roles, error: rolesError }, { data: membership, error: membershipError }] =
    await Promise.all([
      admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("org_id", orgId),
      admin
        .from("organization_memberships")
        .select("id")
        .eq("user_id", userId)
        .eq("org_id", orgId)
        .eq("is_active", true)
        .maybeSingle(),
    ]);
  if (rolesError) throw new Error(`Failed to load user roles: ${rolesError.message}`);
  if (membershipError) throw new Error(`Failed to load membership: ${membershipError.message}`);
  if (!membership) return null;

  let best: OrgRole | null = null;
  for (const row of roles ?? []) {
    if (isOrgRole(row.role) && (best === null || ROLE_RANK[row.role] > ROLE_RANK[best])) {
      best = row.role;
    }
  }
  return best;
}

/** Organization ids where the user holds an active membership. */
export async function getUserOrgIds(userId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_memberships")
    .select("org_id")
    .eq("user_id", userId)
    .eq("is_active", true);
  if (error) throw new Error(`Failed to load memberships: ${error.message}`);
  return (data ?? []).map((m) => m.org_id);
}

export async function requireSuperAdmin(userId: string): Promise<void> {
  if (!(await isSuperAdmin(userId))) {
    throw new AuthorizationError("Super-admin access required.");
  }
}

/**
 * Require the user to hold one of the allowed org roles (super admins pass
 * through). Returns the effective role. Throws AuthorizationError otherwise.
 */
export async function requireOrgRole(
  userId: string,
  orgId: string,
  allowed: OrgRole[] | { atLeast: OrgRole },
): Promise<OrgRole> {
  if (await isSuperAdmin(userId)) return "org_admin";
  const role = await getUserOrgRole(userId, orgId);
  if (!role) throw new AuthorizationError("Organization membership required.");

  const ok = Array.isArray(allowed)
    ? allowed.includes(role)
    : ROLE_RANK[role] >= ROLE_RANK[allowed.atLeast];
  if (!ok) {
    throw new AuthorizationError("Insufficient role for this action.");
  }
  return role;
}

/**
 * Require an active membership in the org (any role). Super admins pass through.
 */
export async function requireOrgMembership(userId: string, orgId: string): Promise<void> {
  if (await isSuperAdmin(userId)) return;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`Failed to check membership: ${error.message}`);
  if (!data) throw new AuthorizationError("Organization membership required.");
}
