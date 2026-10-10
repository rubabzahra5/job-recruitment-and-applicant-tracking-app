"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getDashboardPath, safeNextPath } from "../_lib/dashboard";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

export type LoginResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Sign in with Supabase Auth, then redirect server-side based on roles read
 * from the user_roles table (lib/rbac.ts) — never from client input.
 */
export async function loginAction(input: unknown): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Please check your details and try again.", fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    const msg = (error?.message ?? "").toLowerCase();
    if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
      return {
        ok: false,
        error:
          "Your email address isn't verified yet. Please check your inbox for the verification link, then try again.",
      };
    }
    return { ok: false, error: "Incorrect email or password. Please try again." };
  }

  const next = safeNextPath(parsed.data.next);
  if (next) redirect(next);

  let dashboard = "/candidate";
  try {
    dashboard = await getDashboardPath(data.user.id);
  } catch {
    // Roles unavailable — fall through to the candidate dashboard default.
  }
  redirect(dashboard);
}
