"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCandidate } from "@/app/(candidate)/_lib/candidate-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadPipeline, assertValidTransition, type PipelineLoader } from "@/lib/pipeline";
import { createNotification } from "@/lib/notifications";
import type { ActionResult } from "@/app/(candidate)/_components/form-helpers";

function fail(error: string): ActionResult {
  return { ok: false, error };
}

/**
 * Stages from which a candidate may withdraw their own application.
 * Product policy (stricter than the DB transition table): once an offer is
 * accepted/declined, or the application is hired/rejected/withdrawn, the
 * candidate can no longer withdraw — they must contact the employer.
 */
const CANDIDATE_WITHDRAWABLE_STAGES = new Set([
  "applied",
  "initial_screening",
  "shortlisted",
  "assessment",
  "interview_scheduled",
  "interview_completed",
  "reference_check",
  "offer_pending",
]);

async function requireOwnedApplication(applicationId: string) {
  const user = await requireCandidate();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("applications")
    .select("id,stage,user_id,job_id,snapshot_title,snapshot_org_name")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load application: ${error.message}`);
  const app = data as {
    id: string;
    stage: string;
    user_id: string;
    job_id: string;
    snapshot_title: string | null;
    snapshot_org_name: string | null;
  } | null;
  if (!app || app.user_id !== user.id) {
    throw new Error("Application not found.");
  }
  return { admin, app, user };
}

/**
 * Withdraw an application. Server-side policy check + pipeline transition
 * validation (the DB trigger enforces the same rule for direct SQL writes).
 * Sets stage='withdrawn' (trigger stamps withdrawn_at, freeing the
 * re-apply slot) and appends a status-history row.
 */
export async function withdrawApplication(
  applicationId: string,
): Promise<ActionResult> {
  try {
    const { admin, app, user } = await requireOwnedApplication(applicationId);

    if (!CANDIDATE_WITHDRAWABLE_STAGES.has(app.stage)) {
      return fail(
        "This application can no longer be withdrawn at its current stage. Please contact the employer directly.",
      );
    }

    // lib/pipeline.ts wants a Promise-returning select(); adapt the
    // Supabase query builder (a thenable, not a real Promise) accordingly.
    const loader: PipelineLoader = {
      from: (table: string) => ({
        select: async (columns: string) => {
          const r = await admin.from(table).select(columns);
          return {
            data: r.data as unknown,
            error: r.error ? { message: r.error.message } : null,
          };
        },
      }),
    };
    const { stages, transitions } = await loadPipeline(loader);
    assertValidTransition(app.stage, "withdrawn", stages, transitions);

    const { error: updateError } = await admin
      .from("applications")
      .update({ stage: "withdrawn" })
      .eq("id", app.id);
    if (updateError) {
      throw new Error(`Failed to withdraw application: ${updateError.message}`);
    }

    const { error: historyError } = await admin
      .from("application_status_history")
      .insert({
        application_id: app.id,
        from_stage: app.stage,
        to_stage: "withdrawn",
        changed_by: user.id,
        reason: "Withdrawn by candidate",
      });
    if (historyError) {
      throw new Error(`Failed to record withdrawal: ${historyError.message}`);
    }

    try {
      await createNotification({
        userId: user.id,
        type: "application_withdrawn",
        title: "Application withdrawn",
        body: `You withdrew your application for “${app.snapshot_title ?? "the job"}”.`,
        link: `/candidate/applications/${app.id}`,
      });
    } catch {
      // Best-effort.
    }

    revalidatePath("/candidate/applications");
    revalidatePath("/candidate");
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to withdraw application.");
  }
}

const messageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Write a message first.")
    .max(2000, "Messages must be 2000 characters or less."),
});

/** Post a message in the candidate↔employer thread for an application. */
export async function postApplicationMessage(
  applicationId: string,
  input: { message: string },
): Promise<ActionResult> {
  try {
    const parsed = messageSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid message.");
    }
    const { admin, app, user } = await requireOwnedApplication(applicationId);

    // Only allow messaging on applications that are still in play.
    if (app.stage === "withdrawn") {
      return fail("You can't message about a withdrawn application.");
    }

    const { error } = await admin.from("candidate_messages").insert({
      application_id: app.id,
      sender_user_id: user.id,
      message: parsed.data.message,
      is_from_candidate: true,
    });
    if (error) throw new Error(`Failed to send message: ${error.message}`);

    revalidatePath(`/candidate/applications/${app.id}`);
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to send message.");
  }
}
