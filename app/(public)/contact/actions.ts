"use server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(100),
  email: z.string().trim().email("Enter a valid email address.").max(255),
  subject: z.string().trim().min(3, "Subject is too short.").max(150),
  message: z.string().trim().min(10, "Message must be at least 10 characters.").max(5000),
});

export type ContactResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Persist a contact-form message (anon INSERT via RLS) and notify super
 * admins in-app. Notifications are best-effort: the submission succeeds
 * even if notifying fails.
 */
export async function submitContactMessage(input: unknown): Promise<ContactResult> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields and try again.", fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contact_messages").insert({
    name: parsed.data.name,
    email: parsed.data.email,
    subject: parsed.data.subject,
    message: parsed.data.message,
  });
  if (error) {
    return { ok: false, error: "We couldn't save your message right now. Please try again later." };
  }

  try {
    const admin = createAdminClient();
    const { data: admins } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin")
      .is("org_id", null);
    for (const row of admins ?? []) {
      await createNotification({
        userId: row.user_id as string,
        type: "contact_message",
        title: `New contact message: ${parsed.data.subject}`,
        body: `From ${parsed.data.name} (${parsed.data.email})`,
        link: "/control-center",
      });
    }
  } catch {
    // Best-effort: the message is already stored; never fail the submission.
  }

  return { ok: true };
}
