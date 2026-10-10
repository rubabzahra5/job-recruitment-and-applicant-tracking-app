"use server";

import { z } from "zod";
import { requireSessionUser } from "@/lib/auth";
import { requireOrgRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import {
  getOrgApplication,
  applyStageTransition,
  okResult,
  failResult,
  revalidateEmployer,
  singleRow,
  type ActionResult,
} from "../../_lib/org";
import { RUBRIC_CRITERIA } from "../../_lib/rubric";

/** Move one application to a new pipeline stage (server-validated). */
export async function moveApplicationStage(
  orgId: string,
  applicationId: string,
  toStage: string,
  reason?: string,
): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const admin = createAdminClient();
    const app = await getOrgApplication(admin, applicationId, orgId);

    await applyStageTransition({
      applicationId,
      orgId,
      fromStage: app.stage as string,
      toStage,
      changedBy: user.id,
      reason: reason?.trim() || null,
    });

    await createNotification({
      userId: app.user_id as string,
      type: "application_stage_changed",
      title: "Your application status was updated",
      body: `Your application moved to the "${toStage.replace(/_/g, " ")}" stage.${reason?.trim() ? ` Note: ${reason.trim()}` : ""}`,
      link: `/candidate/applications/${applicationId}`,
    });

    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

const bulkSchema = z.object({
  applicationIds: z.array(z.string().uuid()).min(1).max(50),
  toStage: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export type BulkMoveResult = ActionResult & {
  moved?: number;
  failed?: { id: string; error: string }[];
};

/**
 * Bulk stage update. Bounded to 50 applications; each row is validated
 * individually and failures are reported per row (no mass PII dump).
 */
export async function bulkMoveApplications(
  orgId: string,
  input: { applicationIds: string[]; toStage: string; reason?: string },
): Promise<BulkMoveResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const parsed = bulkSchema.parse(input);
    const admin = createAdminClient();

    const { data: apps } = await admin
      .from("applications")
      .select("id,stage,user_id")
      .eq("org_id", orgId)
      .in("id", parsed.applicationIds);
    const byId = new Map((apps ?? []).map((a) => [a.id as string, a]));

    let moved = 0;
    const failed: { id: string; error: string }[] = [];
    for (const id of parsed.applicationIds) {
      const app = byId.get(id);
      if (!app) {
        failed.push({ id, error: "Not found in this organization." });
        continue;
      }
      try {
        await applyStageTransition({
          applicationId: id,
          orgId,
          fromStage: app.stage as string,
          toStage: parsed.toStage,
          changedBy: user.id,
          reason: parsed.reason?.trim() || null,
        });
        moved++;
        await createNotification({
          userId: app.user_id as string,
          type: "application_stage_changed",
          title: "Your application status was updated",
          body: `Your application moved to the "${parsed.toStage.replace(/_/g, " ")}" stage.`,
          link: `/candidate/applications/${id}`,
        }).catch(() => undefined);
      } catch (e) {
        failed.push({ id, error: e instanceof Error ? e.message : "Failed." });
      }
    }

    await writeAudit({
      actorUserId: user.id,
      action: "application.bulk_stage_changed",
      entityType: "application",
      entityId: null,
      orgId,
      metadata: { toStage: parsed.toStage, moved, failed: failed.length },
    });
    revalidateEmployer();
    return { ok: true, moved, failed };
  } catch (e) {
    return { ...failResult(e), moved: 0, failed: [] };
  }
}

/** Assign an application to a colleague (must be an active org member). */
export async function assignApplication(
  orgId: string,
  applicationId: string,
  assigneeUserId: string,
): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const admin = createAdminClient();
    await getOrgApplication(admin, applicationId, orgId);

    const { data: membership } = await admin
      .from("organization_memberships")
      .select("id")
      .eq("org_id", orgId)
      .eq("user_id", assigneeUserId)
      .eq("is_active", true)
      .maybeSingle();
    if (!membership) throw new Error("Assignee is not an active member of this organization.");

    const { data: existing } = await admin
      .from("application_assignments")
      .select("id")
      .eq("application_id", applicationId)
      .eq("assignee_user_id", assigneeUserId)
      .maybeSingle();
    if (!existing) {
      const { error } = await admin.from("application_assignments").insert({
        application_id: applicationId,
        assignee_user_id: assigneeUserId,
        assigned_by: user.id,
      });
      if (error) throw new Error(`Failed to assign: ${error.message}`);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("display_name,email")
      .eq("id", assigneeUserId)
      .maybeSingle();
    await createNotification({
      userId: assigneeUserId,
      type: "application_assigned",
      title: "An application was assigned to you",
      body: `Assigned by ${(profile?.display_name as string | null) ?? user.id}.`,
      link: `/employer/applications/${applicationId}?org=${encodeURIComponent(orgId)}`,
    }).catch(() => undefined);

    await writeAudit({
      actorUserId: user.id,
      action: "application.assigned",
      entityType: "application",
      entityId: applicationId,
      orgId,
      metadata: { assigneeUserId },
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Remove an assignment. */
export async function unassignApplication(orgId: string, assignmentId: string): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const admin = createAdminClient();
    const { data: assignment } = await admin
      .from("application_assignments")
      .select("id,application_id,applications!inner(org_id)")
      .eq("id", assignmentId)
      .single();
    if (!assignment || singleRow(assignment.applications as { org_id: string } | { org_id: string }[] | null)?.org_id !== orgId) {
      throw new Error("Assignment not found in this organization.");
    }
    const { error } = await admin.from("application_assignments").delete().eq("id", assignmentId);
    if (error) throw new Error(`Failed to remove assignment: ${error.message}`);
    await writeAudit({
      actorUserId: user.id,
      action: "application.unassigned",
      entityType: "application",
      entityId: assignment.application_id as string,
      orgId,
      metadata: { assignmentId },
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

const noteSchema = z.object({ note: z.string().trim().min(1).max(5000) });

/** Add an internal note (never visible to candidates). */
export async function addNote(orgId: string, applicationId: string, note: string): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const parsed = noteSchema.parse({ note });
    const admin = createAdminClient();
    await getOrgApplication(admin, applicationId, orgId);
    const { error } = await admin.from("application_notes").insert({
      application_id: applicationId,
      author_user_id: user.id,
      note: parsed.note,
      is_internal: true,
    });
    if (error) throw new Error(`Failed to add note: ${error.message}`);
    await writeAudit({
      actorUserId: user.id,
      action: "application.note_added",
      entityType: "application",
      entityId: applicationId,
      orgId,
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Edit own internal note (or any note for org_admin/hr_manager). */
export async function updateNote(
  orgId: string,
  noteId: string,
  note: string,
): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    const role = await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const parsed = noteSchema.parse({ note });
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("application_notes")
      .select("id,author_user_id,application_id,applications!inner(org_id)")
      .eq("id", noteId)
      .single();
    if (!existing || singleRow(existing.applications as { org_id: string } | { org_id: string }[] | null)?.org_id !== orgId) {
      throw new Error("Note not found in this organization.");
    }
    const isAuthor = (existing.author_user_id as string) === user.id;
    if (!isAuthor && !["org_admin", "hr_manager"].includes(role)) {
      throw new Error("You can only edit your own notes.");
    }
    const { error } = await admin.from("application_notes").update({ note: parsed.note }).eq("id", noteId);
    if (error) throw new Error(`Failed to update note: ${error.message}`);
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Delete own internal note (or any note for org_admin/hr_manager). */
export async function deleteNote(orgId: string, noteId: string): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    const role = await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("application_notes")
      .select("id,author_user_id,applications!inner(org_id)")
      .eq("id", noteId)
      .single();
    if (!existing || singleRow(existing.applications as { org_id: string } | { org_id: string }[] | null)?.org_id !== orgId) {
      throw new Error("Note not found in this organization.");
    }
    const isAuthor = (existing.author_user_id as string) === user.id;
    if (!isAuthor && !["org_admin", "hr_manager"].includes(role)) {
      throw new Error("You can only delete your own notes.");
    }
    const { error } = await admin.from("application_notes").delete().eq("id", noteId);
    if (error) throw new Error(`Failed to delete note: ${error.message}`);
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

// ─── rating rubric ──────────────────────────────────────────────────────────

const rubricSchema = z.object({
  scores: z.record(z.string(), z.number().int().min(1).max(5)),
  comments: z.record(z.string(), z.string().max(2000)),
  summary: z.string().max(2000),
});

export type RubricInput = z.infer<typeof rubricSchema>;

/**
 * Persist a structured rating rubric as an internal application_notes row
 * (is_internal=true, JSON payload with kind='rubric'). One rubric per author
 * per application — resubmitting updates the author's existing row.
 */
export async function saveRubric(
  orgId: string,
  applicationId: string,
  rubric: RubricInput,
): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const parsed = rubricSchema.parse(rubric);
    const admin = createAdminClient();
    await getOrgApplication(admin, applicationId, orgId);

    const payload = JSON.stringify({
      kind: "rubric",
      scores: parsed.scores,
      comments: parsed.comments,
      summary: parsed.summary,
      rated_at: new Date().toISOString(),
    });

    const { data: existing } = await admin
      .from("application_notes")
      .select("id,note")
      .eq("application_id", applicationId)
      .eq("author_user_id", user.id);
    const rubricRow = (existing ?? []).find((r) => {
      try {
        return (JSON.parse(r.note as string) as { kind?: string }).kind === "rubric";
      } catch {
        return false;
      }
    });

    if (rubricRow) {
      const { error } = await admin.from("application_notes").update({ note: payload }).eq("id", rubricRow.id);
      if (error) throw new Error(`Failed to update rubric: ${error.message}`);
    } else {
      const { error } = await admin.from("application_notes").insert({
        application_id: applicationId,
        author_user_id: user.id,
        note: payload,
        is_internal: true,
      });
      if (error) throw new Error(`Failed to save rubric: ${error.message}`);
    }

    await writeAudit({
      actorUserId: user.id,
      action: "application.rubric_saved",
      entityType: "application",
      entityId: applicationId,
      orgId,
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

// ─── candidate-visible messages ─────────────────────────────────────────────

const messageSchema = z.object({ message: z.string().trim().min(1).max(5000) });

/** Send a candidate-visible message (is_from_candidate=false). */
export async function sendCandidateMessage(
  orgId: string,
  applicationId: string,
  message: string,
): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const parsed = messageSchema.parse({ message });
    const admin = createAdminClient();
    const app = await getOrgApplication(admin, applicationId, orgId);

    const { error } = await admin.from("candidate_messages").insert({
      application_id: applicationId,
      sender_user_id: user.id,
      message: parsed.message,
      is_from_candidate: false,
    });
    if (error) throw new Error(`Failed to send message: ${error.message}`);

    await createNotification({
      userId: app.user_id as string,
      type: "candidate_message",
      title: "New message about your application",
      body: parsed.message.slice(0, 200),
      link: `/candidate/applications/${applicationId}`,
    }).catch(() => undefined);

    await writeAudit({
      actorUserId: user.id,
      action: "application.message_sent",
      entityType: "application",
      entityId: applicationId,
      orgId,
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

// ─── CV signed URL ──────────────────────────────────────────────────────────

export type CvUrlResult = { ok: true; url: string; fileName: string } | { ok: false; error: string };

/**
 * Generate a short-lived signed URL for the candidate's CV after the RBAC
 * check (the candidate applied to this org's job). The cvs bucket is
 * owner-only; staff never get direct storage access.
 */
export async function getCvSignedUrl(orgId: string, applicationId: string): Promise<CvUrlResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const admin = createAdminClient();
    const app = await getOrgApplication(admin, applicationId, orgId);

    // Prefer the application-linked document, fall back to the candidate's current CV.
    let storagePath: string | null = null;
    let fileName = "cv";
    const { data: appDocs } = await admin
      .from("application_documents")
      .select("storage_path,file_name")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (appDocs && appDocs.length > 0) {
      storagePath = appDocs[0]!.storage_path as string;
      fileName = appDocs[0]!.file_name as string;
    } else if (app.document_id) {
      const { data: doc } = await admin
        .from("candidate_documents")
        .select("storage_path,file_name")
        .eq("id", app.document_id)
        .maybeSingle();
      if (doc) {
        storagePath = doc.storage_path as string;
        fileName = doc.file_name as string;
      }
    } else {
      const { data: profile } = await admin
        .from("candidate_profiles")
        .select("id")
        .eq("user_id", app.user_id)
        .maybeSingle();
      if (profile) {
        const { data: cv } = await admin
          .from("candidate_documents")
          .select("storage_path,file_name")
          .eq("profile_id", profile.id)
          .eq("kind", "cv")
          .order("is_current_cv", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cv) {
          storagePath = cv.storage_path as string;
          fileName = cv.file_name as string;
        }
      }
    }

    if (!storagePath) return { ok: false, error: "No CV found for this application." };
    const objectPath = storagePath.replace(/^cvs\//, "");
    const { data, error } = await admin.storage.from("cvs").createSignedUrl(objectPath, 600);
    if (error || !data?.signedUrl) {
      return { ok: false, error: "Could not generate a CV link. Try again." };
    }

    await writeAudit({
      actorUserId: user.id,
      action: "application.cv_viewed",
      entityType: "application",
      entityId: applicationId,
      orgId,
    });
    return { ok: true, url: data.signedUrl, fileName };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load CV." };
  }
}
