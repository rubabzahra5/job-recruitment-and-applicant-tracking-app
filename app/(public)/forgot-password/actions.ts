"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { getEnv } from "@/lib/env";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

/**
 * Request a Supabase password-reset email. Always returns success to avoid
 * revealing whether an address is registered.
 */
export async function requestPasswordReset(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email address." };
  }

  // SECURITY (SEC-10): Rate limit reset requests per IP and per email
  // (3/hour each) so a victim's inbox cannot be flooded. A limited
  // request returns the SAME success response as a real one — the
  // limit must never reveal whether the email is registered.
  const ip = getClientIp(await headers());
  const byIp = await checkRateLimit("password_reset", ip, 3, 3600);
  const byEmail = await checkRateLimit(
    "password_reset",
    `email:${parsed.data.email.toLowerCase()}`,
    3,
    3600,
  );
  if (!byIp.allowed || !byEmail.allowed) {
    return { ok: true };
  }

  let redirectTo: string | undefined;
  try {
    const appUrl = getEnv().NEXT_PUBLIC_APP_URL;
    if (appUrl) redirectTo = `${appUrl.replace(/\/$/, "")}/reset-password`;
  } catch {
    // optional config — Supabase falls back to its site URL
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    redirectTo ? { redirectTo } : undefined,
  );

  // Deliberately generic: never reveal whether the email is registered.
  return { ok: true };
}
