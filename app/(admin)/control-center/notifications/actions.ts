"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminContext } from "@/app/(admin)/_components/admin-server";
import type { ActionResult } from "@/app/(admin)/_components/action-buttons";
import { writeAudit } from "@/lib/audit";
import { getEmailProvider, sendEmail } from "@/lib/email";
import { logDeliveryAttempt } from "@/lib/notifications";

function fail(error: unknown, fallback: string): ActionResult {
  const message = error instanceof Error ? error.message : fallback;
  if (/duplicate|unique/i.test(message)) {
    return { ok: false, error: "That template key is already in use." };
  }
  return { ok: false, error: message };
}

const templateSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9_]+$/, "Key may only contain lowercase letters, numbers and underscores."),
  subject: z.string().trim().min(2, "Subject is required.").max(200),
  body: z.string().trim().min(2, "Body is required.").max(20000),
});

export async function upsertTemplate(
  input: z.infer<typeof templateSchema> & { id?: string },
): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const { id, ...rest } = templateSchema.extend({ id: z.string().uuid().optional() }).parse(input);
    const payload = { key: rest.key, subject: rest.subject, body: rest.body };
    let entityId: string;
    if (id) {
      const { error } = await admin.from("email_templates").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      entityId = id;
    } else {
      const { data, error } = await admin.from("email_templates").insert(payload).select("id").single();
      if (error || !data) throw new Error(error?.message ?? "Create failed.");
      entityId = data.id as string;
    }
    await writeAudit({
      actorUserId: user.id,
      action: id ? "email_template.updated" : "email_template.created",
      entityType: "email_template",
      entityId,
      metadata: { key: rest.key },
    });
    revalidatePath("/control-center/notifications");
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to save template.");
  }
}

export async function deleteTemplate(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const id = z.string().uuid().parse(payload.id);
    const { error } = await admin.from("email_templates").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await writeAudit({ actorUserId: user.id, action: "email_template.deleted", entityType: "email_template", entityId: id });
    revalidatePath("/control-center/notifications");
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to delete template.");
  }
}

/**
 * Retry a failed notification delivery.
 *
 * Honest behavior: the provider is only contacted when one is configured.
 * When unconfigured, the retry is refused with an explicit
 * "email_unconfigured" status — nothing claims delivery.
 */
export async function retryDelivery(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const logId = z.string().uuid().parse(payload.logId);
    const { data: log, error: gErr } = await admin
      .from("notification_delivery_logs")
      .select("id,channel,status,notification_id,notification:notifications(id,user_id,title,body,link)")
      .eq("id", logId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!log) return { ok: false, error: "Delivery log not found." };
    if (log.status !== "failed") return { ok: false, error: "Only failed deliveries can be retried." };
    const notification = log.notification as {
      id?: string;
      user_id?: string;
      title?: string;
      body?: string | null;
    } | null;
    if (!notification?.user_id) {
      return { ok: false, error: "The original notification no longer exists; cannot retry." };
    }
    if (log.channel !== "email") {
      return { ok: false, error: `Channel "${log.channel as string}" retries are not supported from here.` };
    }

    const provider = getEmailProvider();
    if (!provider) {
      await logDeliveryAttempt({
        notificationId: notification.id ?? null,
        channel: "email",
        status: "skipped",
        providerResponse: "retry refused: email_unconfigured",
      });
      await writeAudit({
        actorUserId: user.id,
        action: "notification.retry_refused",
        entityType: "notification_delivery_log",
        entityId: logId,
        metadata: { reason: "email_unconfigured" },
      });
      return { ok: false, error: "Email is unconfigured — retry refused. Configure RESEND_API_KEY and EMAIL_FROM_ADDRESS first." };
    }

    const { data: profile } = await admin.from("profiles").select("email").eq("id", notification.user_id).maybeSingle();
    const to = profile?.email as string | undefined;
    if (!to) return { ok: false, error: "Recipient has no email address." };

    const result = await sendEmail({
      to,
      subject: notification.title ?? "HirePakistan notification",
      html: `<p>${(notification.body ?? "").replace(/</g, "&lt;")}</p>`,
      text: notification.body ?? undefined,
    });
    await logDeliveryAttempt({
      notificationId: notification.id ?? null,
      channel: "email",
      status: result.sent ? "sent" : "failed",
      providerResponse: result.sent
        ? `retried via ${provider.name}: ${result.providerId}`
        : `retry failed: ${result.reason}${result.detail ? ` — ${result.detail}` : ""}`,
    });
    await writeAudit({
      actorUserId: user.id,
      action: result.sent ? "notification.retried" : "notification.retry_failed",
      entityType: "notification_delivery_log",
      entityId: logId,
      metadata: { to, provider: provider.name },
    });
    revalidatePath("/control-center/notifications");
    return result.sent
      ? { ok: true }
      : { ok: false, error: `Provider attempt failed (${result.reason}). See delivery logs.` };
  } catch (e) {
    return fail(e, "Retry failed.");
  }
}
