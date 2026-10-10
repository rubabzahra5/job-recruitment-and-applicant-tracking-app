"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCandidate } from "@/app/(candidate)/_lib/candidate-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/(candidate)/_components/form-helpers";

function fail(error: string, fieldErrors?: Record<string, string>): ActionResult {
  return { ok: false, error, fieldErrors };
}

export interface AccountInfo {
  userId: string;
  email: string | null;
  displayName: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
}

/** Account + session facts for the settings page. */
export async function getAccountInfo(): Promise<AccountInfo> {
  const user = await requireCandidate();
  const admin = createAdminClient();
  const [{ data: profile }, { data: authUser }] = await Promise.all([
    admin.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    admin.auth.admin.getUserById(user.id),
  ]);
  return {
    userId: user.id,
    email: user.email,
    displayName: (profile as { display_name: string | null } | null)?.display_name ?? null,
    createdAt: authUser.user?.created_at ?? null,
    lastSignInAt: authUser.user?.last_sign_in_at ?? null,
  };
}

const displayNameSchema = z.object({
  display_name: z.string().trim().min(2, "Enter a display name.").max(80),
});

/** Update the account display name (profiles table). */
export async function updateDisplayName(input: {
  display_name: string;
}): Promise<ActionResult> {
  try {
    const parsed = displayNameSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid name.");
    }
    const user = await requireCandidate();
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ display_name: parsed.data.display_name })
      .eq("id", user.id);
    if (error) throw new Error(`Failed to update display name: ${error.message}`);
    revalidatePath("/candidate/settings");
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to update display name.");
  }
}

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(255),
});

/**
 * Change the account email via Supabase Auth's real flow: Supabase sends a
 * confirmation link to the NEW address; the change completes when the user
 * clicks it. We report exactly that — nothing is claimed before confirmation.
 */
export async function changeEmail(input: { email: string }): Promise<ActionResult> {
  try {
    const parsed = emailSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid email.");
    }
    const user = await requireCandidate();
    if (parsed.data.email.toLowerCase() === (user.email ?? "").toLowerCase()) {
      return fail("That's already your email address.");
    }
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ email: parsed.data.email });
    if (error) throw new Error(error.message);
    revalidatePath("/candidate/settings");
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to change email.");
  }
}

const passwordSchema = z
  .object({
    new_password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(128),
    confirm_password: z.string(),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    message: "Passwords don't match.",
    path: ["confirm_password"],
  });

/** Change the account password via Supabase Auth (real flow, session-bound). */
export async function changePassword(input: {
  new_password: string;
  confirm_password: string;
}): Promise<ActionResult> {
  try {
    const parsed = passwordSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const fieldErrors: Record<string, string> = {};
      if (first?.path[0]) fieldErrors[String(first.path[0])] = first.message;
      return fail(first?.message ?? "Invalid password.", fieldErrors);
    }
    await requireCandidate();
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.new_password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to change password.");
  }
}
