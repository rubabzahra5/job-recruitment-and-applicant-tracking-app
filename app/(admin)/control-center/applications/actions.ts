"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminContext, loadPipelineAdmin } from "@/app/(admin)/_components/admin-server";
import type { ActionResult } from "@/app/(admin)/_components/action-buttons";
import { writeAudit } from "@/lib/audit";
import { assertValidTransition } from "@/lib/pipeline";

/**
 * Super-admin stage change on any application.
 * Validated against the DB-loaded pipeline (lib/pipeline.ts) AND the
 * validate_application_stage_transition trigger; every change is audited and
 * appended to application_status_history.
 */
export async function changeApplicationStage(
  payload: Record<string, string>,
  note: string,
): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const applicationId = z.string().uuid().parse(payload.applicationId);
    const toStage = z.string().min(1).parse(payload.toStage);

    const { data: app, error: gErr } = await admin
      .from("applications")
      .select("id,stage,org_id,job_id,user_id")
      .eq("id", applicationId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!app) return { ok: false, error: "Application not found." };
    const fromStage = app.stage as string;
    if (fromStage === toStage) return { ok: false, error: "Application is already at that stage." };

    const { stages, transitions } = await loadPipelineAdmin(admin);
    assertValidTransition(fromStage, toStage, stages, transitions);

    const { error: uErr } = await admin
      .from("applications")
      .update({ stage: toStage })
      .eq("id", applicationId);
    if (uErr) throw new Error(uErr.message);
    const { error: hErr } = await admin.from("application_status_history").insert({
      application_id: applicationId,
      from_stage: fromStage,
      to_stage: toStage,
      changed_by: user.id,
      reason: note,
    });
    if (hErr) throw new Error(hErr.message);

    await writeAudit({
      actorUserId: user.id,
      action: "application.stage_changed",
      entityType: "application",
      entityId: applicationId,
      orgId: app.org_id as string,
      metadata: { from: fromStage, to: toStage, note, job_id: app.job_id, candidate: app.user_id },
    });
    revalidatePath("/control-center/applications");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Stage change failed." };
  }
}
