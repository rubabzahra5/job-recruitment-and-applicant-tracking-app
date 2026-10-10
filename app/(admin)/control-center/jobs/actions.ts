"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminContext } from "@/app/(admin)/_components/admin-server";
import type { ActionResult } from "@/app/(admin)/_components/action-buttons";
import { writeAudit } from "@/lib/audit";

function fail(error: unknown, fallback: string): ActionResult {
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}

const decisionSchema = z.enum(["approved", "rejected"]);
const statusSchema = z.enum(["published", "paused", "closed", "archived"]);

/** Approve or reject a job; the decision + moderation note go to job_approvals. */
export async function moderateJob(payload: Record<string, string>, note: string): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const jobId = z.string().uuid().parse(payload.jobId);
    const decision = decisionSchema.parse(payload.decision);

    const { data: job, error: gErr } = await admin
      .from("jobs")
      .select("id,org_id,title,status")
      .eq("id", jobId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!job) return { ok: false, error: "Job not found." };

    const newStatus = decision === "approved" ? "approved" : "rejected";
    const { error: uErr } = await admin.from("jobs").update({ status: newStatus }).eq("id", jobId);
    if (uErr) throw new Error(uErr.message);
    const { error: aErr } = await admin.from("job_approvals").insert({
      job_id: jobId,
      decided_by: user.id,
      decision,
      note,
    });
    if (aErr) throw new Error(aErr.message);
    await writeAudit({
      actorUserId: user.id,
      action: `job.${decision}`,
      entityType: "job",
      entityId: jobId,
      orgId: job.org_id as string,
      metadata: { title: job.title, note },
    });
    revalidatePath("/control-center/jobs");
    revalidatePath(`/control-center/jobs/${jobId}`);
    revalidatePath("/control-center/approvals");
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to moderate job.");
  }
}

/** Publish / pause / close / archive a job (operational status changes). */
export async function setJobStatus(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const jobId = z.string().uuid().parse(payload.jobId);
    const status = statusSchema.parse(payload.status);
    const { data: job, error: gErr } = await admin
      .from("jobs")
      .select("id,org_id,title,status")
      .eq("id", jobId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!job) return { ok: false, error: "Job not found." };

    const update: Record<string, unknown> = { status };
    if (status === "published") update.published_at = new Date().toISOString();
    const { error: uErr } = await admin.from("jobs").update(update).eq("id", jobId);
    if (uErr) throw new Error(uErr.message);
    await writeAudit({
      actorUserId: user.id,
      action: `job.status_${status}`,
      entityType: "job",
      entityId: jobId,
      orgId: job.org_id as string,
      metadata: { title: job.title, from: job.status },
    });
    revalidatePath("/control-center/jobs");
    revalidatePath(`/control-center/jobs/${jobId}`);
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to update job status.");
  }
}
