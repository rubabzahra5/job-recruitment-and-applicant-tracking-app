"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminContext } from "@/app/(admin)/_components/admin-server";
import type { ActionResult } from "@/app/(admin)/_components/action-buttons";
import { writeAudit } from "@/lib/audit";

/**
 * Decide a pending offer. Approval records go to offer_approvals with the
 * approver's note; approved offers move to "sent", rejected ones back to "draft".
 */
export async function decideOffer(payload: Record<string, string>, note: string): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const offerId = z.string().uuid().parse(payload.offerId);
    const decision = z.enum(["approved", "rejected"]).parse(payload.decision);

    const { data: offer, error: gErr } = await admin
      .from("offers")
      .select("id,org_id,status,job:jobs(title)")
      .eq("id", offerId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!offer) return { ok: false, error: "Offer not found." };
    if (offer.status !== "pending_approval") {
      return { ok: false, error: "Only pending_approval offers can be decided." };
    }

    const { error: aErr } = await admin.from("offer_approvals").insert({
      offer_id: offerId,
      approver_user_id: user.id,
      decision,
      note,
    });
    if (aErr) throw new Error(aErr.message);
    const { error: uErr } = await admin
      .from("offers")
      .update({ status: decision === "approved" ? "sent" : "draft" })
      .eq("id", offerId);
    if (uErr) throw new Error(uErr.message);

    const job = offer.job as { title?: string } | null;
    await writeAudit({
      actorUserId: user.id,
      action: `offer.${decision}`,
      entityType: "offer",
      entityId: offerId,
      orgId: offer.org_id as string,
      metadata: { note, job_title: job?.title ?? null },
    });
    revalidatePath("/control-center/approvals");
    revalidatePath("/control-center/offers");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to decide offer." };
  }
}
