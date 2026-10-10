import "server-only";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSessionUser, type SessionUser } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/rbac";
import { loadPipeline, type PipelineLoader } from "@/lib/pipeline";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface AdminContext {
  user: SessionUser;
  /** Service-role client. Only constructed AFTER the super-admin check. */
  admin: AdminClient;
}

/**
 * Authorize a control-center request.
 *
 * - Verifies the session (requireSessionUser).
 * - Verifies the super_admin grant FRESH from `user_roles` on EVERY call via
 *   requireSuperAdmin — no cached/stale role trust, no client claims.
 * - Only then hands out the service-role client.
 *
 * Throws AuthorizationError ("Super-admin access required.") for non-admins.
 * Middleware redirects are redirect-only and are NOT treated as authorization.
 */
export async function adminContext(): Promise<AdminContext> {
  const user = await requireSessionUser();
  await requireSuperAdmin(user.id);
  return { user, admin: createAdminClient() };
}

export class AdminDeniedError extends Error {
  constructor(message = "Super-admin access required.") {
    super(message);
    this.name = "AdminDeniedError";
  }
}

/**
 * Page-level guard. Unauthenticated visitors are redirected to the main
 * sign-in (preserving `next`); signed-in non-admins get AdminDeniedError so
 * the page can render a generic "not authorized" screen without leaking
 * which check failed or any org internals.
 */
export async function adminPageGuard(nextPath: string): Promise<AdminContext> {
  let user: SessionUser;
  try {
    user = await requireSessionUser();
  } catch {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  try {
    await requireSuperAdmin(user.id);
  } catch {
    throw new AdminDeniedError();
  }
  return { user, admin: createAdminClient() };
}

/**
 * Refuse to suspend/revoke the final ACTIVE super administrator.
 * "Active" = holds the super_admin grant AND profiles.is_active = true.
 */
export async function ensureNotLastActiveSuperAdmin(
  admin: AdminClient,
  targetUserId: string,
): Promise<void> {
  const { data: grants, error } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin")
    .is("org_id", null);
  if (error) throw new Error(`Failed to check super-admin roster: ${error.message}`);
  const ids = [...new Set((grants ?? []).map((g) => g.user_id as string))];
  if (!ids.includes(targetUserId)) return;

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .in("id", ids)
    .eq("is_active", true);
  if (profileError) {
    throw new Error(`Failed to check super-admin roster: ${profileError.message}`);
  }
  const activeIds = (profiles ?? []).map((p) => p.id as string);
  if (activeIds.length <= 1 && activeIds.includes(targetUserId)) {
    throw new Error(
      "Refusing: this is the last active super administrator. " +
        "Promote another administrator before suspending or revoking this one.",
    );
  }
}

/** Read one string query param (Next may give string | string[] | undefined). */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Mask a name/email/phone for the privacy-guarded browser. */
export function mask(value: string | null | undefined, keepStart = 1): string {
  if (!value) return "••••";
  const visible = value.slice(0, keepStart);
  return `${visible}••••••`;
}

export function getPagination(
  searchParams: Record<string, string | string[] | undefined>,
  perPage = 20,
) {
  const raw = firstParam(searchParams.page);
  const page = Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);
  return { page, perPage, from: (page - 1) * perPage, to: page * perPage - 1 };
}

/**
 * Parse an optional YYYY-MM-DD date filter into an inclusive UTC range.
 * Returns nulls when absent/invalid (callers then skip the filter).
 */
export function parseDateRange(searchParams: Record<string, string | string[] | undefined>): {
  from: string | null;
  to: string | null;
} {
  const rawFrom = firstParam(searchParams.from);
  const rawTo = firstParam(searchParams.to);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const from = rawFrom && iso.test(rawFrom) ? `${rawFrom}T00:00:00Z` : null;
  // Inclusive end-of-day: use start of the next day as an exclusive bound.
  let to: string | null = null;
  if (rawTo && iso.test(rawTo)) {
    const d = new Date(`${rawTo}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    to = d.toISOString();
  }
  return { from, to };
}

/** Apply created_at range to a Supabase query builder (chainable).
 * Typed as `any` deliberately: the untyped admin client returns `any` rows,
 * and threading the PostgrestFilterBuilder generics through a helper breaks
 * type inference (data collapses to GenericStringError).
 */
export function applyDateRange(query: any, range: { from: string | null; to: string | null }, column = "created_at"): any {
  let q = query;
  if (range.from) q = q.gte(column, range.from);
  if (range.to) q = q.lt(column, range.to);
  return q;
}

/**
 * Cast an untyped Supabase result set to a row shape.
 *
 * The service-role client is untyped (`any` schema). Selects that use explicit
 * FK-hint joins (`table!fk_name(...)`) make supabase-js's result inference
 * collapse to `GenericStringError[]` — a type-level quirk only; the runtime
 * payload is correct. Cast through `unknown` at the boundary instead of
 * fighting the generics.
 */
export function asRows<T>(data: unknown): T[] {
  return (Array.isArray(data) ? data : []) as T[];
}

/**
 * Load the hiring pipeline (stages + transitions) via the admin client.
 *
 * lib/pipeline.ts's PipelineLoader expects a real Promise from select(), but
 * the PostgrestFilterBuilder is only thenable, so the admin client needs this
 * thin adapter.
 */
export function loadPipelineAdmin(admin: AdminClient) {
  const loader: PipelineLoader = {
    from: (table: string) => ({
      select: async (columns: string) => {
        const res = await (admin.from as any)(table).select(columns);
        return {
          data: res.data as unknown,
          error: res.error ? { message: String(res.error.message) } : null,
        };
      },
    }),
  };
  return loadPipeline(loader);
}
