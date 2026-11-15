"use server";

import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Shared completion for an admin sign-in: if the session belongs to a
 * super_admin, audit it and succeed; otherwise destroy the session and
 * fail generically — callers must NOT distinguish "bad credentials"
 * from "not an admin".
 */
async function completeAdminLogin(
  supabase: ServerClient,
  user: User | null,
): Promise<{ ok: boolean }> {
  if (user && (await isSuperAdmin(user.id))) {
    await writeAudit({
      actorUserId: user.id,
      action: "auth.admin_login",
      entityType: "user",
      entityId: user.id,
    });
    return { ok: true };
  }

  // Not a super admin (or no session): destroy any session and fail generically.
  await supabase.auth.signOut();
  return { ok: false };
}

/**
 * Verify an admin sign-in server-side.
 *
 * Called after the client signs in with email+password. If the session is not
 * a super_admin, the session is destroyed and a generic failure is returned —
 * callers must NOT distinguish "bad credentials" from "not an admin".
 */
export async function verifyAdminLogin(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return completeAdminLogin(supabase, user);
}

const adminLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

/**
 * Control-center sign-in (SEC-03).
 *
 * The whole sign-in runs server-side so the brute-force rate limit can
 * be applied BEFORE any password is attempted: previously the form
 * signed in client-side directly against Supabase Auth and only the
 * follow-up check ran server-side, leaving the most powerful account
 * on the platform without the app's attempt limit. Behaviour is
 * otherwise identical to the old flow: one generic failure for wrong
 * password, non-admin and rate-limited attempts alike; the session is
 * destroyed for non-admins; successful admin logins are audit-logged.
 */
export async function adminLoginAction(input: unknown): Promise<{ ok: boolean }> {
  const parsed = adminLoginSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  // Rate limit BEFORE the password attempt (5 attempts/minute per IP).
  const ip = getClientIp(await headers());
  const { allowed } = await checkRateLimit("admin_login", ip, 5, 60);
  if (!allowed) return { ok: false };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) return { ok: false };

  return completeAdminLogin(supabase, data.user);
}
