import { createClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string | null;
}

/**
 * Server-side: return the currently authenticated user, or null.
 * Uses the request-bound server client (RLS applies downstream).
 *
 * SEC-07: a suspended account (profiles.is_active = false, set from the
 * control center) is treated as signed out here, so every consumer of
 * the session — portal layouts, guards, actions — rejects it the same
 * way it rejects an anonymous visitor. Suspension deliberately does NOT
 * cascade to organization memberships; that product decision stays with
 * the founder. Control-center views OF a suspended user are unaffected:
 * they read through the service-role admin client, not this helper.
 *
 * Fail-soft: if the profile row cannot be read (missing/error), the
 * session stands — only an explicit is_active = false suspends.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (profile && (profile as { is_active: boolean }).is_active === false) {
    return null;
  }

  return { id: user.id, email: user.email ?? null };
}

/**
 * Server-side: return the authenticated user or throw.
 * Convenience for pages/actions that require sign-in; pair with requireRole()
 * from lib/rbac.ts for authorization.
 */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Authentication required.");
  }
  return user;
}
