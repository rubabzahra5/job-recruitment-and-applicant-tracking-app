import "server-only";

import { getUserRoles } from "@/lib/rbac";

/**
 * Server-side, role-based landing page after sign-in.
 * Roles are ALWAYS read from the user_roles table via lib/rbac.ts —
 * never from client input, cookies, or request bodies.
 */
export async function getDashboardPath(userId: string): Promise<string> {
  const roles = await getUserRoles(userId);
  if (roles.some((r) => r.role === "super_admin" && r.orgId === null)) {
    return "/control-center";
  }
  if (roles.some((r) => r.orgId !== null)) {
    return "/employer";
  }
  return "/candidate";
}

/** Only allow redirects to same-origin app paths (no open redirects). */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  return next;
}
