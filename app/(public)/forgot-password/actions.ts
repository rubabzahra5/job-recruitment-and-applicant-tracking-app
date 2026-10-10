"use server";

import { z } from "zod";

import { getEnv } from "@/lib/env";
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
