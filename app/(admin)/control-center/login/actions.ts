"use server";

import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

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
