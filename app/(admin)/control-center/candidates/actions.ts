"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminContext } from "@/app/(admin)/_components/admin-server";
import type { ActionResult } from "@/app/(admin)/_components/action-buttons";
import { writeAudit } from "@/lib/audit";

function fail(error: unknown, fallback: string): ActionResult {
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}

export interface RevealedCandidate {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  province: string;
  headline: string;
}

/**
 * Authorized PII reveal. The reveal itself is written to audit_logs BEFORE the
 * data is returned — every disclosure is attributable.
 */
export async function revealCandidatePII(
  payload: Record<string, string>,
): Promise<ActionResult & { candidate?: RevealedCandidate }> {
  try {
    const { user, admin } = await adminContext();
    const candidateUserId = z.string().uuid().parse(payload.candidateUserId);
    const [{ data: cp, error: cpErr }, { data: profile, error: pErr }] = await Promise.all([
      admin.from("candidate_profiles").select("full_name,phone,city,province,headline").eq("user_id", candidateUserId).maybeSingle(),
      admin.from("profiles").select("email").eq("id", candidateUserId).maybeSingle(),
    ]);
    if (cpErr) throw new Error(cpErr.message);
    if (pErr) throw new Error(pErr.message);
    if (!cp) return { ok: false, error: "Candidate profile not found." };

    await writeAudit({
      actorUserId: user.id,
      action: "candidate_pii_revealed",
      entityType: "candidate_profile",
      entityId: candidateUserId,
      metadata: { via: "control-center", candidate_user_id: candidateUserId },
    });
    return {
      ok: true,
      candidate: {
        fullName: (cp.full_name as string) ?? "",
        email: (profile?.email as string) ?? "",
        phone: (cp.phone as string) ?? "",
        city: (cp.city as string) ?? "",
        province: (cp.province as string) ?? "",
        headline: (cp.headline as string) ?? "",
      },
    };
  } catch (e) {
    return fail(e, "Failed to reveal candidate details.");
  }
}

const requestDecision = z.enum(["in_progress", "completed", "rejected"]);

/**
 * Process a privacy request (export / deletion / correction).
 * For deletion+completed: removes the candidate profile and its dependent rows
 * (education, experience, skills, certifications, documents cascade).
 * Applications are business records of hiring orgs and are retained — this is
 * stated in the audit metadata and the UI.
 */
export async function processPrivacyRequest(
  payload: Record<string, string>,
  note: string,
): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const requestId = z.string().uuid().parse(payload.requestId);
    const decision = requestDecision.parse(payload.decision);

    const { data: req, error: gErr } = await admin
      .from("privacy_requests")
      .select("id,user_id,type,status")
      .eq("id", requestId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!req) return { ok: false, error: "Privacy request not found." };
    if (req.status === "completed" || req.status === "rejected") {
      return { ok: false, error: "This request has already been resolved." };
    }

    let dataDeleted = false;
    if (req.type === "deletion" && decision === "completed") {
      const { error: dErr } = await admin
        .from("candidate_profiles")
        .delete()
        .eq("user_id", req.user_id);
      if (dErr) throw new Error(dErr.message);
      dataDeleted = true;
    }

    const { error: uErr } = await admin
      .from("privacy_requests")
      .update({
        status: decision,
        detail: note,
        resolved_at: decision === "completed" || decision === "rejected" ? new Date().toISOString() : null,
      })
      .eq("id", requestId);
    if (uErr) throw new Error(uErr.message);

    await writeAudit({
      actorUserId: user.id,
      action: `privacy_request.${decision}`,
      entityType: "privacy_request",
      entityId: requestId,
      metadata: {
        note,
        type: req.type,
        candidate_user_id: req.user_id,
        candidate_data_deleted: dataDeleted,
        applications_retained: "applications are hiring-org business records and were retained",
      },
    });
    revalidatePath("/control-center/candidates");
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to process privacy request.");
  }
}
