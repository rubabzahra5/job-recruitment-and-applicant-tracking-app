"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  code: z.string().min(1, "Missing reset code."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});

export type ResetResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Complete Supabase's password-reset flow: exchange the emailed code for a
 * session, then set the new password. Single-use codes — invalid or expired
 * links are reported honestly.
 */
export async function resetPasswordAction(input: unknown): Promise<ResetResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(parsed.data.code);
  if (exchangeError) {
    return {
      ok: false,
      error: "This reset link is invalid or has expired. Please request a new one.",
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (updateError) {
    return { ok: false, error: "We couldn't update your password. Please request a new reset link and try again." };
  }

  redirect("/login?message=password-updated");
}
