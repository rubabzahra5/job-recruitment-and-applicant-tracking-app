import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationChannel = "in_app" | "email" | "sms";

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

/**
 * Create an in-app notification and record its delivery in
 * notification_delivery_logs (channel=in_app, status=sent).
 *
 * Email/SMS fan-out is a separate concern for later phases: those channels
 * are queued via delivery logs by the code that actually sends them
 * (lib/email.ts), keeping a single honest record of what was attempted.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<NotificationRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notifications")
    .insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    })
    .select()
    .single();
  if (error || !data) {
    throw new Error(`Failed to create notification: ${error?.message ?? "unknown"}`);
  }

  const { error: logError } = await admin.from("notification_delivery_logs").insert({
    notification_id: data.id,
    channel: "in_app",
    status: "sent",
  });
  if (logError) {
    throw new Error(`Failed to write delivery log: ${logError.message}`);
  }
  return data as NotificationRow;
}

/** Record a delivery attempt for another channel (email/sms) without duplicating rows. */
export async function logDeliveryAttempt(input: {
  notificationId: string | null;
  channel: NotificationChannel;
  status: "queued" | "sent" | "failed" | "skipped";
  providerResponse?: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("notification_delivery_logs").insert({
    notification_id: input.notificationId,
    channel: input.channel,
    status: input.status,
    provider_response: input.providerResponse ?? null,
  });
  if (error) throw new Error(`Failed to write delivery log: ${error.message}`);
}

export async function markNotificationRead(
  notificationId: string,
  userId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to mark notification read: ${error.message}`);
}
