import { createClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string | null;
}

/**
 * Server-side: return the currently authenticated user, or null.
 * Uses the request-bound server client (RLS applies downstream).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
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
