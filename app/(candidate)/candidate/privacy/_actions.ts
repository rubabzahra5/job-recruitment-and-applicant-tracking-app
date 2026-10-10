"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCandidate } from "@/app/(candidate)/_lib/candidate-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/app/(candidate)/_components/form-helpers";

function fail(error: string): ActionResult {
  return { ok: false, error };
}

export interface PrivacyRequestRow {
  id: string;
  type: string;
  status: string;
  detail: string | null;
  created_at: string;
  resolved_at: string | null;
}

/** The candidate's own privacy requests (user_id = auth.uid()). */
export async function listPrivacyRequests(): Promise<PrivacyRequestRow[]> {
  const user = await requireCandidate();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("privacy_requests")
    .select("id,type,status,detail,created_at,resolved_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load privacy requests: ${error.message}`);
  return (data ?? []) as PrivacyRequestRow[];
}

const requestSchema = z.object({
  detail: z.string().trim().max(2000, "Details must be 2000 characters or less.").optional(),
});

/**
 * File a deletion request. Honest semantics: the request is recorded as
 * `pending` for platform review — it is NOT executed instantly, because
 * hiring records tied to applications may be subject to retention rules
 * (e.g. an employer's legal hiring records, or an active application).
 */
export async function requestDeletion(input: { detail?: string }): Promise<ActionResult> {
  try {
    const parsed = requestSchema.safeParse(input ?? {});
    if (!parsed.success) return fail("Invalid request details.");
    const user = await requireCandidate();
    const admin = createAdminClient();

    const { data: pending } = await admin
      .from("privacy_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "deletion")
      .eq("status", "pending")
      .limit(1);
    if (pending && pending.length > 0) {
      return fail("You already have a pending deletion request. We'll update you when it's reviewed.");
    }

    const { error } = await admin.from("privacy_requests").insert({
      user_id: user.id,
      type: "deletion",
      detail: parsed.data.detail?.trim() || null,
    });
    if (error) throw new Error(`Failed to file request: ${error.message}`);
    revalidatePath("/candidate/privacy");
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to file request.");
  }
}

/** File a correction request for inaccurate personal data. */
export async function requestCorrection(input: { detail: string }): Promise<ActionResult> {
  try {
    const schema = z.object({
      detail: z.string().trim().min(10, "Describe what needs correcting (at least 10 characters).").max(2000),
    });
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid request details.");
    }
    const user = await requireCandidate();
    const admin = createAdminClient();
    const { error } = await admin.from("privacy_requests").insert({
      user_id: user.id,
      type: "correction",
      detail: parsed.data.detail,
    });
    if (error) throw new Error(`Failed to file request: ${error.message}`);
    revalidatePath("/candidate/privacy");
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to file request.");
  }
}

/**
 * Build a full data export from live queries: profile + related records,
 * applications (answers, status history, messages, document metadata),
 * saved jobs, alerts, notifications, consents and past privacy requests.
 * Document file *contents* are not included — only metadata; CVs can be
 * downloaded individually from the Resume page.
 */
export async function exportCandidateData(): Promise<Record<string, unknown>> {
  const user = await requireCandidate();
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("candidate_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const profileId = (profile as { id: string } | null)?.id ?? null;

  const [account, education, experience, skills, certifications, documents] =
    await Promise.all([
      admin.from("profiles").select("id,email,display_name,created_at").eq("id", user.id).maybeSingle(),
      profileId ? admin.from("candidate_education").select("*").eq("profile_id", profileId) : { data: [] },
      profileId ? admin.from("candidate_experience").select("*").eq("profile_id", profileId) : { data: [] },
      profileId ? admin.from("candidate_skills").select("*").eq("profile_id", profileId) : { data: [] },
      profileId ? admin.from("candidate_certifications").select("*").eq("profile_id", profileId) : { data: [] },
      profileId
        ? admin.from("candidate_documents").select("id,file_name,mime_type,size_bytes,kind,is_current_cv,created_at").eq("profile_id", profileId)
        : { data: [] },
    ]);

  const { data: applications } = await admin
    .from("applications")
    .select("id,job_id,org_id,stage,cover_letter,snapshot_title,snapshot_org_name,submitted_at,withdrawn_at,created_at")
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false });
  const appIds = ((applications ?? []) as Array<{ id: string }>).map((a) => a.id);

  const [answers, appDocs, history, messages, interviews] = appIds.length
    ? await Promise.all([
        admin.from("application_answers").select("application_id,question_text,answer,created_at").in("application_id", appIds),
        admin.from("application_documents").select("application_id,file_name,mime_type,size_bytes,created_at").in("application_id", appIds),
        admin.from("application_status_history").select("application_id,from_stage,to_stage,reason,created_at").in("application_id", appIds).order("created_at"),
        admin.from("candidate_messages").select("application_id,message,is_from_candidate,created_at").in("application_id", appIds).order("created_at"),
        admin.from("interviews").select("application_id,scheduled_at,duration_minutes,format,venue,status").in("application_id", appIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const [saved, alerts, notifications, prefs, consents, requests] = await Promise.all([
    admin.from("saved_jobs").select("created_at,job:jobs(title,slug)").eq("user_id", user.id),
    admin.from("job_alerts").select("name,filters,is_active,last_run_at,created_at").eq("user_id", user.id),
    admin.from("notifications").select("type,title,body,link,is_read,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    admin.from("notification_preferences").select("prefs,updated_at").eq("user_id", user.id).maybeSingle(),
    admin.from("consent_records").select("purpose,granted,granted_at,source").eq("user_id", user.id).order("granted_at", { ascending: false }),
    admin.from("privacy_requests").select("type,status,detail,created_at,resolved_at").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);

  return {
    exported_at: new Date().toISOString(),
    account: account.data ?? null,
    candidate_profile: profile ?? null,
    education: education.data ?? [],
    experience: experience.data ?? [],
    skills: skills.data ?? [],
    certifications: certifications.data ?? [],
    documents_metadata: documents.data ?? [],
    applications: applications ?? [],
    application_answers: answers.data ?? [],
    application_documents_metadata: appDocs.data ?? [],
    application_status_history: history.data ?? [],
    candidate_messages: messages.data ?? [],
    interviews: interviews.data ?? [],
    saved_jobs: saved.data ?? [],
    job_alerts: alerts.data ?? [],
    notifications: notifications.data ?? [],
    notification_preferences: prefs.data ?? null,
    consent_records: consents.data ?? [],
    privacy_requests: requests.data ?? [],
  };
}
