"use server";

import { z } from "zod";
import { requireSessionUser } from "@/lib/auth";
import { requireOrgRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { sendEmail, type EmailResult } from "@/lib/email";
import { karachiWallClockToUTC, formatPKR, formatDateOnlyKarachi } from "@/lib/format";
import {
  getOrgApplication,
  applyStageTransition,
  listOrgMembers,
  okResult,
  failResult,
  revalidateEmployer,
  singleRow,
  type ActionResult,
} from "../../_lib/org";

const offerInputSchema = z.object({
  applicationId: z.string().uuid(),
  salaryAmount: z.number().min(0).nullable(),
  salaryPeriod: z.enum(["monthly", "annual", "hourly", "project"]).nullable(),
  joiningDate: z.string().nullable(), // YYYY-MM-DD
  expiresAt: z.string().nullable(), // "YYYY-MM-DDTHH:mm" Karachi wall clock
  terms: z.string().max(5000).nullable(),
});

export type OfferInput = z.infer<typeof offerInputSchema>;

export type OfferActionResult = ActionResult & {
  email?: { sent: boolean; reason?: string };
};

async function getOrgOffer(admin: ReturnType<typeof createAdminClient>, offerId: string, orgId: string) {
  const { data, error } = await admin
    .from("offers")
    .select("*, applications!inner(id,org_id,user_id,stage,job_id,jobs(title))")
    .eq("id", offerId)
    .eq("org_id", orgId)
    .single();
  if (error || !data) throw new Error("Offer not found in this organization.");
  return data as Record<string, unknown> & {
    applications: { id: string; org_id: string; user_id: string; stage: string; job_id: string; jobs: { title: string } | null };
  };
}

async function candidateEmail(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle();
  return (data?.email as string | null) ?? null;
}

function emailSummary(result: EmailResult): { sent: boolean; reason?: string } {
  return result.sent ? { sent: true } : { sent: false, reason: result.reason };
}

/** Create an offer in draft. */
export async function createOffer(orgId: string, input: OfferInput): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const parsed = offerInputSchema.parse(input);
    const admin = createAdminClient();
    const app = await getOrgApplication(admin, parsed.applicationId, orgId);
    if (["hired", "rejected", "withdrawn", "offer_declined"].includes(app.stage as string)) {
      throw new Error("Cannot create an offer for an application in a terminal stage.");
    }

    let expiresAt: string | null = null;
    if (parsed.expiresAt) {
      const d = karachiWallClockToUTC(parsed.expiresAt);
      if (d.getTime() <= Date.now()) throw new Error("Offer expiry must be in the future.");
      expiresAt = d.toISOString();
    }

    const { data: offer, error } = await admin
      .from("offers")
      .insert({
        application_id: parsed.applicationId,
        job_id: app.job_id,
        org_id: orgId,
        salary_amount: parsed.salaryAmount,
        salary_period: parsed.salaryPeriod,
        joining_date: parsed.joiningDate || null,
        expires_at: expiresAt,
        status: "draft",
        terms: parsed.terms?.trim() || null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !offer) throw new Error(`Failed to create offer: ${error?.message ?? "unknown"}`);

    await writeAudit({
      actorUserId: user.id,
      action: "offer.created",
      entityType: "offer",
      entityId: offer.id as string,
      orgId,
      metadata: { applicationId: parsed.applicationId },
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Update a draft offer. */
export async function updateOffer(orgId: string, offerId: string, input: OfferInput): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const parsed = offerInputSchema.parse(input);
    const admin = createAdminClient();
    const offer = await getOrgOffer(admin, offerId, orgId);
    if ((offer.status as string) !== "draft") throw new Error("Only draft offers can be edited.");

    let expiresAt: string | null = null;
    if (parsed.expiresAt) {
      const d = karachiWallClockToUTC(parsed.expiresAt);
      if (d.getTime() <= Date.now()) throw new Error("Offer expiry must be in the future.");
      expiresAt = d.toISOString();
    }

    const { error } = await admin
      .from("offers")
      .update({
        salary_amount: parsed.salaryAmount,
        salary_period: parsed.salaryPeriod,
        joining_date: parsed.joiningDate || null,
        expires_at: expiresAt,
        terms: parsed.terms?.trim() || null,
      })
      .eq("id", offerId);
    if (error) throw new Error(`Failed to update offer: ${error.message}`);
    await writeAudit({ actorUserId: user.id, action: "offer.updated", entityType: "offer", entityId: offerId, orgId });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Submit a draft offer for approval; notifies org admins and HR managers. */
export async function submitOfferForApproval(orgId: string, offerId: string): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const admin = createAdminClient();
    const offer = await getOrgOffer(admin, offerId, orgId);
    if ((offer.status as string) !== "draft") throw new Error("Only draft offers can be submitted for approval.");

    const { error } = await admin.from("offers").update({ status: "pending_approval" }).eq("id", offerId);
    if (error) throw new Error(`Failed to submit: ${error.message}`);

    const members = await listOrgMembers(orgId);
    for (const m of members.filter((x) => x.isActive && ["org_admin", "hr_manager"].includes(x.role ?? ""))) {
      await createNotification({
        userId: m.userId,
        type: "offer_approval_requested",
        title: "Offer approval requested",
        body: `An offer for "${offer.applications.jobs?.title ?? "a vacancy"}" needs your approval.`,
        link: `/employer/offers?org=${encodeURIComponent(orgId)}`,
      }).catch(() => undefined);
    }

    await writeAudit({ actorUserId: user.id, action: "offer.submitted_for_approval", entityType: "offer", entityId: offerId, orgId });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Approve an offer (org_admin/hr_manager, not the creator). Offer returns to draft, ready to send. */
export async function approveOffer(orgId: string, offerId: string, note?: string): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    const role = await requireOrgRole(user.id, orgId, ["org_admin", "hr_manager"]);
    void role;
    const admin = createAdminClient();
    const offer = await getOrgOffer(admin, offerId, orgId);
    if ((offer.status as string) !== "pending_approval") throw new Error("Offer is not pending approval.");
    if ((offer.created_by as string) === user.id) throw new Error("You cannot approve your own offer.");

    const { error: apprError } = await admin.from("offer_approvals").insert({
      offer_id: offerId,
      approver_user_id: user.id,
      decision: "approved",
      note: note?.trim() || null,
    });
    if (apprError) throw new Error(`Failed to record approval: ${apprError.message}`);
    const { error } = await admin.from("offers").update({ status: "draft" }).eq("id", offerId);
    if (error) throw new Error(`Failed to update offer: ${error.message}`);

    await createNotification({
      userId: offer.created_by as string,
      type: "offer_approved",
      title: "Offer approved",
      body: `Your offer for "${offer.applications.jobs?.title ?? "a vacancy"}" was approved and is ready to send.`,
      link: `/employer/offers?org=${encodeURIComponent(orgId)}`,
    }).catch(() => undefined);

    await writeAudit({ actorUserId: user.id, action: "offer.approved", entityType: "offer", entityId: offerId, orgId });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Reject an offer approval request (records the decision + note). */
export async function rejectOfferApproval(orgId: string, offerId: string, note: string): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, ["org_admin", "hr_manager"]);
    if (!note.trim()) throw new Error("A rejection note is required.");
    const admin = createAdminClient();
    const offer = await getOrgOffer(admin, offerId, orgId);
    if ((offer.status as string) !== "pending_approval") throw new Error("Offer is not pending approval.");
    if ((offer.created_by as string) === user.id) throw new Error("You cannot reject your own offer.");

    const { error: apprError } = await admin.from("offer_approvals").insert({
      offer_id: offerId,
      approver_user_id: user.id,
      decision: "rejected",
      note: note.trim(),
    });
    if (apprError) throw new Error(`Failed to record decision: ${apprError.message}`);
    const { error } = await admin.from("offers").update({ status: "draft" }).eq("id", offerId);
    if (error) throw new Error(`Failed to update offer: ${error.message}`);

    await createNotification({
      userId: offer.created_by as string,
      type: "offer_rejected",
      title: "Offer approval rejected",
      body: `Your offer was sent back: ${note.trim()}`,
      link: `/employer/offers?org=${encodeURIComponent(orgId)}`,
    }).catch(() => undefined);

    await writeAudit({
      actorUserId: user.id,
      action: "offer.approval_rejected",
      entityType: "offer",
      entityId: offerId,
      orgId,
      metadata: { note: note.trim() },
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

async function hasApproval(admin: ReturnType<typeof createAdminClient>, offerId: string, creatorId: string): Promise<boolean> {
  const { data } = await admin
    .from("offer_approvals")
    .select("id")
    .eq("offer_id", offerId)
    .eq("decision", "approved")
    .neq("approver_user_id", creatorId)
    .limit(1);
  return (data ?? []).length > 0;
}

/**
 * Send the offer to the candidate. Requires an approval row unless the sender
 * is org_admin/hr_manager. Moves the application to offer_pending (validated).
 * Email is attempted honestly; the result is reported, never assumed.
 */
export async function sendOffer(orgId: string, offerId: string): Promise<OfferActionResult> {
  try {
    const user = await requireSessionUser();
    const role = await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const admin = createAdminClient();
    const offer = await getOrgOffer(admin, offerId, orgId);
    if ((offer.status as string) !== "draft") throw new Error("Only draft offers can be sent.");

    const privileged = ["org_admin", "hr_manager"].includes(role);
    if (!privileged && !(await hasApproval(admin, offerId, offer.created_by as string))) {
      throw new Error("This offer needs approval from an org admin or HR manager before it can be sent.");
    }

    // Advance the application first — a failed pipeline move blocks the send.
    await applyStageTransition({
      applicationId: offer.applications.id,
      orgId,
      fromStage: offer.applications.stage,
      toStage: "offer_pending",
      changedBy: user.id,
      reason: "Offer sent",
    });

    const { error } = await admin.from("offers").update({ status: "sent" }).eq("id", offerId);
    if (error) throw new Error(`Failed to send offer: ${error.message}`);

    const candidateId = offer.applications.user_id;
    const salaryText = offer.salary_amount != null ? formatPKR(Number(offer.salary_amount)) : "as discussed";
    await createNotification({
      userId: candidateId,
      type: "offer_sent",
      title: "You have a job offer",
      body: `${offer.applications.jobs?.title ?? "A position"} — ${salaryText}${offer.joining_date ? `, joining ${formatDateOnlyKarachi(offer.joining_date as string)}` : ""}.`,
      link: `/candidate/applications/${offer.applications.id}`,
    }).catch(() => undefined);

    let email: { sent: boolean; reason?: string } | undefined;
    const to = await candidateEmail(admin, candidateId);
    if (to) {
      const result = await sendEmail({
        to,
        subject: `Job offer: ${offer.applications.jobs?.title ?? "a position"}`,
        html: `<p>You have received a job offer for <strong>${offer.applications.jobs?.title ?? "a position"}</strong>.</p><p>Compensation: ${salaryText}.</p><p>Sign in to TalentBridge to review and respond.</p>`,
        text: `You have received a job offer for ${offer.applications.jobs?.title ?? "a position"}. Compensation: ${salaryText}. Sign in to TalentBridge to review and respond.`,
      });
      email = emailSummary(result);
    } else {
      email = { sent: false, reason: "no_candidate_email" };
    }

    await writeAudit({
      actorUserId: user.id,
      action: "offer.sent",
      entityType: "offer",
      entityId: offerId,
      orgId,
      metadata: { emailSent: email.sent, emailReason: email.reason ?? null },
    });
    revalidateEmployer();
    return { ok: true, email };
  } catch (e) {
    return failResult(e);
  }
}

/** Record the candidate's decision on a sent offer. */
export async function recordOfferDecision(
  orgId: string,
  offerId: string,
  decision: "accepted" | "declined",
): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const admin = createAdminClient();
    const offer = await getOrgOffer(admin, offerId, orgId);
    if ((offer.status as string) !== "sent") throw new Error("Only sent offers can be marked accepted/declined.");

    const toStage = decision === "accepted" ? "offer_accepted" : "offer_declined";
    await applyStageTransition({
      applicationId: offer.applications.id,
      orgId,
      fromStage: offer.applications.stage,
      toStage,
      changedBy: user.id,
      reason: `Offer ${decision}`,
    });

    const { error } = await admin.from("offers").update({ status: decision }).eq("id", offerId);
    if (error) throw new Error(`Failed to record decision: ${error.message}`);

    await writeAudit({ actorUserId: user.id, action: `offer.${decision}`, entityType: "offer", entityId: offerId, orgId });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Withdraw an offer with a reason. A pending application is moved to rejected. */
export async function withdrawOffer(orgId: string, offerId: string, reason: string): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    if (!reason.trim()) throw new Error("A withdrawal reason is required.");
    const admin = createAdminClient();
    const offer = await getOrgOffer(admin, offerId, orgId);
    if (!["draft", "pending_approval", "sent"].includes(offer.status as string)) {
      throw new Error("This offer can no longer be withdrawn.");
    }

    const { error } = await admin.from("offers").update({ status: "withdrawn" }).eq("id", offerId);
    if (error) throw new Error(`Failed to withdraw offer: ${error.message}`);

    if (offer.applications.stage === "offer_pending") {
      await applyStageTransition({
        applicationId: offer.applications.id,
        orgId,
        fromStage: "offer_pending",
        toStage: "rejected",
        changedBy: user.id,
        reason: `Offer withdrawn: ${reason.trim()}`,
      });
    }

    await createNotification({
      userId: offer.applications.user_id,
      type: "offer_withdrawn",
      title: "Offer withdrawn",
      body: `The offer for "${offer.applications.jobs?.title ?? "a position"}" was withdrawn. Reason: ${reason.trim()}`,
      link: `/candidate/applications/${offer.applications.id}`,
    }).catch(() => undefined);

    await writeAudit({
      actorUserId: user.id,
      action: "offer.withdrawn",
      entityType: "offer",
      entityId: offerId,
      orgId,
      metadata: { reason: reason.trim() },
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Mark an expired sent offer as expired. */
export async function expireOffer(orgId: string, offerId: string): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const admin = createAdminClient();
    const offer = await getOrgOffer(admin, offerId, orgId);
    if ((offer.status as string) !== "sent") throw new Error("Only sent offers can expire.");
    if (offer.expires_at && new Date(offer.expires_at as string).getTime() > Date.now()) {
      throw new Error("This offer has not expired yet.");
    }
    const { error } = await admin.from("offers").update({ status: "expired" }).eq("id", offerId);
    if (error) throw new Error(`Failed to expire offer: ${error.message}`);
    await writeAudit({ actorUserId: user.id, action: "offer.expired", entityType: "offer", entityId: offerId, orgId });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/**
 * Mark hired: creates the hiring_records row and moves the application
 * offer_accepted → hired. If the stage move fails, the hiring record is
 * rolled back so the two stay consistent.
 */
export async function markHired(orgId: string, offerId: string, notes?: string): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const admin = createAdminClient();
    const offer = await getOrgOffer(admin, offerId, orgId);
    if ((offer.status as string) !== "accepted") {
      throw new Error("Only accepted offers can be marked as hired.");
    }

    const { data: record, error: recordError } = await admin
      .from("hiring_records")
      .insert({
        application_id: offer.applications.id,
        offer_id: offerId,
        notes: notes?.trim() || null,
      })
      .select("id")
      .single();
    if (recordError || !record) throw new Error(`Failed to create hiring record: ${recordError?.message ?? "unknown"}`);

    try {
      await applyStageTransition({
        applicationId: offer.applications.id,
        orgId,
        fromStage: offer.applications.stage,
        toStage: "hired",
        changedBy: user.id,
        reason: "Marked as hired",
      });
    } catch (stageError) {
      await admin.from("hiring_records").delete().eq("id", record.id);
      throw new Error(
        `Could not move the application to "hired": ${stageError instanceof Error ? stageError.message : "invalid transition"}. The hiring record was rolled back.`,
      );
    }

    await createNotification({
      userId: offer.applications.user_id,
      type: "application_hired",
      title: "Welcome aboard!",
      body: `Your application for "${offer.applications.jobs?.title ?? "the position"}" was marked as hired.`,
      link: `/candidate/applications/${offer.applications.id}`,
    }).catch(() => undefined);

    await writeAudit({
      actorUserId: user.id,
      action: "offer.marked_hired",
      entityType: "offer",
      entityId: offerId,
      orgId,
      metadata: { hiringRecordId: record.id },
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Applications eligible for a new offer (page helper). */
export async function getOfferableApplications(orgId: string) {
  const user = await requireSessionUser();
  await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
  const admin = createAdminClient();
  const { data } = await admin
    .from("applications")
    .select("id,stage,user_id,jobs(title)")
    .eq("org_id", orgId)
    .not("stage", "in", "(hired,rejected,withdrawn,offer_declined)")
    .order("submitted_at", { ascending: false })
    .limit(500);
  const userIds = [...new Set((data ?? []).map((a) => a.user_id as string))];
  const { data: profiles } = userIds.length > 0
    ? await admin.from("candidate_profiles").select("user_id,full_name").in("user_id", userIds)
    : { data: [] as { user_id: string; full_name: string }[] };
  const nameByUser = new Map((profiles ?? []).map((p) => [p.user_id as string, p.full_name as string]));
  return (data ?? []).map((a) => ({
    id: a.id as string,
    label: `${nameByUser.get(a.user_id as string) ?? "Candidate"} — ${singleRow(a.jobs as { title: string } | { title: string }[] | null)?.title ?? "—"} (${(a.stage as string).replace(/_/g, " ")})`,
  }));
}
