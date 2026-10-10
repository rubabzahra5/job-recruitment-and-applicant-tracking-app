"use server";

import { z } from "zod";
import { requireSessionUser } from "@/lib/auth";
import { requireOrgRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { karachiWallClockToUTC, formatDateKarachi } from "@/lib/format";
import {
  getOrgApplication,
  applyStageTransition,
  listOrgMembers,
  okResult,
  failResult,
  revalidateEmployer,
  type ActionResult,
} from "../../_lib/org";

const interviewInputSchema = z.object({
  applicationId: z.string().uuid(),
  scheduledAt: z.string().min(1, "Date and time are required."), // "YYYY-MM-DDTHH:mm" Karachi wall clock
  durationMinutes: z.number().int().min(5).max(480),
  format: z.enum(["in_person", "video", "phone"]),
  venue: z.string().max(300).optional(),
  meetingLink: z.string().max(500).optional().refine(
    (v) => !v || /^https?:\/\//i.test(v),
    { message: "Meeting link must be a valid http(s) URL." },
  ),
  interviewerUserIds: z.array(z.string().uuid()).min(1, "Select at least one interviewer.").max(10),
  instructions: z.string().max(2000).optional(),
});

export type InterviewInput = z.infer<typeof interviewInputSchema>;

interface TimeWindow {
  id: string;
  applicationId: string;
  start: number;
  end: number;
  participantUserIds: string[];
}

/**
 * Conflict detection: block when the new window overlaps an existing
 * scheduled/rescheduled interview for the SAME application or ANY shared
 * interviewer.
 */
async function findConflicts(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  applicationId: string,
  interviewerUserIds: string[],
  start: Date,
  durationMinutes: number,
  excludeInterviewId?: string,
): Promise<string | null> {
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const padStart = new Date(start.getTime() - 8 * 3_600_000).toISOString();
  const padEnd = new Date(end.getTime() + 8 * 3_600_000).toISOString();

  const { data: existing } = await admin
    .from("interviews")
    .select("id,application_id,scheduled_at,duration_minutes")
    .eq("org_id", orgId)
    .in("status", ["scheduled", "rescheduled"])
    .gte("scheduled_at", padStart)
    .lte("scheduled_at", padEnd);
  const rows = (existing ?? []).filter((r) => r.id !== excludeInterviewId);
  if (rows.length === 0) return null;

  const { data: parts } = await admin
    .from("interview_participants")
    .select("interview_id,user_id")
    .in("interview_id", rows.map((r) => r.id as string));
  const usersByInterview = new Map<string, string[]>();
  for (const p of parts ?? []) {
    const list = usersByInterview.get(p.interview_id as string) ?? [];
    if (p.user_id) list.push(p.user_id as string);
    usersByInterview.set(p.interview_id as string, list);
  }

  const windows: TimeWindow[] = rows.map((r) => {
    const s = new Date(r.scheduled_at as string).getTime();
    return {
      id: r.id as string,
      applicationId: r.application_id as string,
      start: s,
      end: s + ((r.duration_minutes as number) ?? 30) * 60_000,
      participantUserIds: usersByInterview.get(r.id as string) ?? [],
    };
  });

  for (const w of windows) {
    const overlaps = start.getTime() < w.end && end.getTime() > w.start;
    if (!overlaps) continue;
    if (w.applicationId === applicationId) {
      return "This application already has an interview overlapping the selected time.";
    }
    const shared = w.participantUserIds.filter((u) => interviewerUserIds.includes(u));
    if (shared.length > 0) {
      return "One of the selected interviewers already has an interview overlapping the selected time.";
    }
  }
  return null;
}

async function notifyInterviewParties(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  applicationId: string,
  interviewId: string,
  title: string,
  body: string,
) {
  const [{ data: app }, { data: participants }] = await Promise.all([
    admin.from("applications").select("user_id").eq("id", applicationId).single(),
    admin.from("interview_participants").select("user_id").eq("interview_id", interviewId),
  ]);
  const userIds = new Set<string>();
  if (app?.user_id) userIds.add(app.user_id as string);
  for (const p of participants ?? []) if (p.user_id) userIds.add(p.user_id as string);
  for (const uid of userIds) {
    await createNotification({
      userId: uid,
      type: "interview",
      title,
      body,
      link: `/employer/interviews?org=${encodeURIComponent(orgId)}`,
    }).catch(() => undefined);
  }
}

/** Schedule an interview with conflict detection. */
export async function scheduleInterview(orgId: string, input: InterviewInput): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const parsed = interviewInputSchema.parse(input);
    const admin = createAdminClient();
    const app = await getOrgApplication(admin, parsed.applicationId, orgId);

    const scheduledAt = karachiWallClockToUTC(parsed.scheduledAt);
    if (scheduledAt.getTime() <= Date.now()) {
      throw new Error("Interview must be scheduled in the future.");
    }

    // Interviewers must be active org members.
    const members = await listOrgMembers(orgId);
    const activeIds = new Set(members.filter((m) => m.isActive).map((m) => m.userId));
    for (const id of parsed.interviewerUserIds) {
      if (!activeIds.has(id)) throw new Error("An interviewer is not an active member of this organization.");
    }

    const conflict = await findConflicts(admin, orgId, parsed.applicationId, parsed.interviewerUserIds, scheduledAt, parsed.durationMinutes);
    if (conflict) throw new Error(conflict);

    const { data: interview, error } = await admin
      .from("interviews")
      .insert({
        application_id: parsed.applicationId,
        job_id: app.job_id,
        org_id: orgId,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: parsed.durationMinutes,
        timezone: "Asia/Karachi",
        format: parsed.format,
        venue: parsed.venue?.trim() || null,
        meeting_link: parsed.meetingLink?.trim() || null, // only stored when genuinely provided
        instructions: parsed.instructions?.trim() || null,
        status: "scheduled",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !interview) throw new Error(`Failed to schedule interview: ${error?.message ?? "unknown"}`);
    const interviewId = interview.id as string;

    const memberById = new Map(members.map((m) => [m.userId, m]));
    const { error: partError } = await admin.from("interview_participants").insert(
      parsed.interviewerUserIds.map((uid) => {
        const m = memberById.get(uid);
        return {
          interview_id: interviewId,
          user_id: uid,
          name: m?.displayName ?? m?.email ?? "Interviewer",
          email: m?.email ?? "",
          role_text: m?.title ?? m?.role ?? null,
        };
      }),
    );
    if (partError) {
      await admin.from("interviews").delete().eq("id", interviewId);
      throw new Error(`Failed to add interviewers: ${partError.message}`);
    }

    // Advance the application to interview_scheduled when the pipeline allows it.
    try {
      await applyStageTransition({
        applicationId: parsed.applicationId,
        orgId,
        fromStage: app.stage as string,
        toStage: "interview_scheduled",
        changedBy: user.id,
        reason: "Interview scheduled",
      });
    } catch {
      // Leave the stage untouched when the transition isn't valid from here.
    }

    await notifyInterviewParties(
      admin,
      orgId,
      parsed.applicationId,
      interviewId,
      "Interview scheduled",
      `An interview is scheduled for ${formatDateKarachi(scheduledAt)} (Asia/Karachi).`,
    );

    await writeAudit({
      actorUserId: user.id,
      action: "interview.scheduled",
      entityType: "interview",
      entityId: interviewId,
      orgId,
      metadata: { applicationId: parsed.applicationId, scheduledAt: scheduledAt.toISOString() },
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Reschedule an interview (conflict-checked, status → rescheduled). */
export async function rescheduleInterview(
  orgId: string,
  interviewId: string,
  scheduledAtLocal: string,
  durationMinutes: number,
): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const admin = createAdminClient();
    const { data: interview } = await admin
      .from("interviews")
      .select("id,application_id,status")
      .eq("id", interviewId)
      .eq("org_id", orgId)
      .single();
    if (!interview) throw new Error("Interview not found in this organization.");
    if (!["scheduled", "rescheduled"].includes(interview.status as string)) {
      throw new Error("Only scheduled interviews can be rescheduled.");
    }
    const { data: parts } = await admin
      .from("interview_participants")
      .select("user_id")
      .eq("interview_id", interviewId);
    const interviewerIds = (parts ?? []).map((p) => p.user_id as string).filter(Boolean);

    const scheduledAt = karachiWallClockToUTC(scheduledAtLocal);
    if (scheduledAt.getTime() <= Date.now()) throw new Error("Interview must be scheduled in the future.");
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
      throw new Error("Duration must be between 5 and 480 minutes.");
    }

    const conflict = await findConflicts(
      admin, orgId, interview.application_id as string, interviewerIds, scheduledAt, durationMinutes, interviewId,
    );
    if (conflict) throw new Error(conflict);

    const { error } = await admin
      .from("interviews")
      .update({ scheduled_at: scheduledAt.toISOString(), duration_minutes: durationMinutes, status: "rescheduled" })
      .eq("id", interviewId);
    if (error) throw new Error(`Failed to reschedule: ${error.message}`);

    await notifyInterviewParties(admin, orgId, interview.application_id as string, interviewId, "Interview rescheduled", `The interview is now at ${formatDateKarachi(scheduledAt)} (Asia/Karachi).`);
    await writeAudit({
      actorUserId: user.id,
      action: "interview.rescheduled",
      entityType: "interview",
      entityId: interviewId,
      orgId,
      metadata: { scheduledAt: scheduledAt.toISOString() },
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Cancel an interview with a reason; notifies candidate + interviewers. */
export async function cancelInterview(orgId: string, interviewId: string, reason: string): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    if (!reason.trim()) throw new Error("A cancellation reason is required.");
    const admin = createAdminClient();
    const { data: interview } = await admin
      .from("interviews")
      .select("id,application_id,status")
      .eq("id", interviewId)
      .eq("org_id", orgId)
      .single();
    if (!interview) throw new Error("Interview not found in this organization.");
    if ((interview.status as string) === "cancelled") throw new Error("Interview is already cancelled.");

    const { error } = await admin.from("interviews").update({ status: "cancelled" }).eq("id", interviewId);
    if (error) throw new Error(`Failed to cancel: ${error.message}`);

    await notifyInterviewParties(admin, orgId, interview.application_id as string, interviewId, "Interview cancelled", `Reason: ${reason.trim()}`);
    await writeAudit({
      actorUserId: user.id,
      action: "interview.cancelled",
      entityType: "interview",
      entityId: interviewId,
      orgId,
      metadata: { reason: reason.trim() },
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Mark attendance (completed / no_show). Completing advances the pipeline when valid. */
export async function markAttendance(
  orgId: string,
  interviewId: string,
  status: "completed" | "no_show",
): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const admin = createAdminClient();
    const { data: interview } = await admin
      .from("interviews")
      .select("id,application_id,status")
      .eq("id", interviewId)
      .eq("org_id", orgId)
      .single();
    if (!interview) throw new Error("Interview not found in this organization.");

    const { error } = await admin.from("interviews").update({ status }).eq("id", interviewId);
    if (error) throw new Error(`Failed to update attendance: ${error.message}`);

    if (status === "completed") {
      const app = await getOrgApplication(admin, interview.application_id as string, orgId);
      try {
        await applyStageTransition({
          applicationId: interview.application_id as string,
          orgId,
          fromStage: app.stage as string,
          toStage: "interview_completed",
          changedBy: user.id,
          reason: "Interview completed",
        });
      } catch {
        // Leave the stage untouched when the transition isn't valid from here.
      }
    }

    await writeAudit({
      actorUserId: user.id,
      action: "interview.attendance_marked",
      entityType: "interview",
      entityId: interviewId,
      orgId,
      metadata: { status },
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

// ─── feedback ─────────────────────────────────────────────────────────────

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  strengths: z.string().max(2000).optional(),
  concerns: z.string().max(2000).optional(),
  recommendation: z.enum(["hire", "no_hire", "maybe"]),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;

/** Submit (or update) structured feedback for an interview — one row per reviewer. */
export async function submitFeedback(
  orgId: string,
  interviewId: string,
  input: FeedbackInput,
): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const parsed = feedbackSchema.parse(input);
    const admin = createAdminClient();
    const { data: interview } = await admin
      .from("interviews")
      .select("id")
      .eq("id", interviewId)
      .eq("org_id", orgId)
      .single();
    if (!interview) throw new Error("Interview not found in this organization.");

    const { error } = await admin.from("interview_feedback").upsert(
      {
        interview_id: interviewId,
        reviewer_user_id: user.id,
        rating: parsed.rating,
        strengths: parsed.strengths?.trim() || null,
        concerns: parsed.concerns?.trim() || null,
        recommendation: parsed.recommendation,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "interview_id,reviewer_user_id" },
    );
    if (error) throw new Error(`Failed to save feedback: ${error.message}`);

    await writeAudit({
      actorUserId: user.id,
      action: "interview.feedback_submitted",
      entityType: "interview",
      entityId: interviewId,
      orgId,
      metadata: { rating: parsed.rating, recommendation: parsed.recommendation },
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Org members eligible as interviewers (page helper). */
export async function getInterviewerOptions(orgId: string) {
  const user = await requireSessionUser();
  await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
  const members = await listOrgMembers(orgId);
  return members
    .filter((m) => m.isActive)
    .map((m) => ({ userId: m.userId, name: m.displayName ?? m.email, role: m.role, title: m.title }));
}
