"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCandidate } from "@/app/(candidate)/_lib/candidate-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { markNotificationRead } from "@/lib/notifications";
import type { ActionResult } from "@/app/(candidate)/_components/form-helpers";
import { DEFAULT_PREFS, type NotificationPrefs } from "./_lib/prefs";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}

async function requireOwnedNotification(notificationId: string) {
  const user = await requireCandidate();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notifications")
    .select("id")
    .eq("id", notificationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load notification: ${error.message}`);
  if (!data) throw new Error("Notification not found.");
  return { admin, user };
}

/** The candidate's own notifications, newest first (user_id = auth.uid()). */
export async function listNotifications(limit = 50): Promise<NotificationItem[]> {
  const user = await requireCandidate();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notifications")
    .select("id,type,title,body,link,is_read,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load notifications: ${error.message}`);
  return (data ?? []) as NotificationItem[];
}

export async function markRead(notificationId: string): Promise<ActionResult> {
  try {
    const { user } = await requireOwnedNotification(notificationId);
    await markNotificationRead(notificationId, user.id);
    revalidatePath("/candidate/notifications");
    revalidatePath("/candidate");
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to mark as read.");
  }
}

export async function markUnread(notificationId: string): Promise<ActionResult> {
  try {
    const { admin, user } = await requireOwnedNotification(notificationId);
    const { error } = await admin
      .from("notifications")
      .update({ is_read: false })
      .eq("id", notificationId)
      .eq("user_id", user.id);
    if (error) throw new Error(`Failed to mark as unread: ${error.message}`);
    revalidatePath("/candidate/notifications");
    revalidatePath("/candidate");
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to mark as unread.");
  }
}

export async function markAllRead(): Promise<ActionResult> {
  try {
    const user = await requireCandidate();
    const admin = createAdminClient();
    const { error } = await admin
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (error) throw new Error(`Failed to mark all as read: ${error.message}`);
    revalidatePath("/candidate/notifications");
    revalidatePath("/candidate");
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to mark all as read.");
  }
}

// ─── Preferences ────────────────────────────────────────────────────────────

const prefsSchema = z.object({
  in_app: z.boolean(),
  email: z.boolean(),
  sms: z.boolean(),
  application_updates: z.boolean(),
  interview_reminders: z.boolean(),
  job_alert_digests: z.boolean(),
});

export async function getPreferences(): Promise<NotificationPrefs> {
  const user = await requireCandidate();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notification_preferences")
    .select("prefs")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load preferences: ${error.message}`);
  const stored = (data?.prefs ?? {}) as Partial<NotificationPrefs>;
  return { ...DEFAULT_PREFS, ...stored };
}

export async function savePreferences(
  input: NotificationPrefs,
): Promise<ActionResult> {
  try {
    const parsed = prefsSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid preferences.");
    const user = await requireCandidate();
    const admin = createAdminClient();
    const { error } = await admin.from("notification_preferences").upsert(
      { user_id: user.id, prefs: parsed.data },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(`Failed to save preferences: ${error.message}`);
    revalidatePath("/candidate/notifications");
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to save preferences.");
  }
}
