"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getEnv } from "@/lib/env";
import { normalizePhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath, safeNextPath } from "../_lib/dashboard";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(100),
  email: z.string().trim().email("Enter a valid email address.").max(255),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
  accountType: z.enum(["candidate", "employer"]),
  phone: z.string().trim().max(32).optional(),
  next: z.string().optional(),
});

export type RegisterResult =
  | { ok: true; pendingVerification: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Real Supabase Auth sign-up. Grants the platform-wide `candidate` role for
 * candidate accounts (server-side, via the service role — never from client
 * input). Employer organization setup continues in /employer onboarding.
 */
export async function registerAction(input: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields and try again.", fieldErrors };
  }

  const { name, email, password, accountType } = parsed.data;

  const phoneCheck = normalizePhone(parsed.data.phone);
  if (!phoneCheck.valid) {
    return {
      ok: false,
      error: "Please fix the highlighted fields and try again.",
      fieldErrors: { phone: phoneCheck.error ?? "Enter a valid phone number." },
    };
  }

  const supabase = await createClient();

  let emailRedirectTo: string | undefined;
  try {
    const appUrl = getEnv().NEXT_PUBLIC_APP_URL;
    if (appUrl) emailRedirectTo = `${appUrl.replace(/\/$/, "")}/login?verified=1`;
  } catch {
    // optional config — omit when unavailable
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: name,
        account_type: accountType,
        phone: phoneCheck.normalized,
      },
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
    },
  });

  if (error || !data.user) {
    const msg = (error?.message ?? "").toLowerCase();
    if (msg.includes("already registered") || msg.includes("already exists")) {
      return {
        ok: false,
        error: "An account with this email already exists.",
        fieldErrors: { email: "This email is already registered. Try logging in instead." },
      };
    }
    return { ok: false, error: "Registration failed. Please try again." };
  }

  // Grant the candidate role server-side (best-effort — never fail sign-up).
  if (accountType === "candidate") {
    try {
      const admin = createAdminClient();
      await admin.from("user_roles").insert({
        user_id: data.user.id,
        role: "candidate",
        org_id: null,
      });
    } catch {
      // The candidate dashboard can repair a missing grant.
    }
  }

  // Email confirmation disabled → signed in immediately.
  if (data.session) {
    const next = safeNextPath(parsed.data.next);
    if (next) redirect(next);
    if (accountType === "employer") redirect("/employer");
    let dashboard = "/candidate";
    try {
      dashboard = await getDashboardPath(data.user.id);
    } catch {
      // default stands
    }
    redirect(dashboard);
  }

  // Email confirmation required — Supabase has sent the verification email.
  return { ok: true, pendingVerification: true };
}
