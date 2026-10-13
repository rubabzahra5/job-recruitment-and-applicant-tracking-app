"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  requireCandidate,
  getOrCreateCandidateProfile,
} from "@/app/(candidate)/_lib/candidate-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/app/(candidate)/_components/form-helpers";

const submitSchema = z.object({
  jobSlug: z.string().min(1),
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      answer: z.string().trim().max(5000, "Answer must be 5000 characters or less."),
    }),
  ),
  documentId: z.string().uuid("Select a CV to attach."),
  coverLetter: z
    .string()
    .trim()
    .max(10000, "Cover letter must be 10000 characters or less.")
    .optional(),
  consent: z
    .boolean()
    .refine((v) => v === true, {
      message: "Please accept the application privacy consent.",
    }),
});

export type SubmitApplicationInput = z.infer<typeof submitSchema>;

export interface SubmitResult extends ActionResult {
  code?: "ALREADY_APPLIED" | "JOB_CLOSED" | "JOB_NOT_FOUND" | "RATE_LIMITED";
  applicationId?: string;
}

interface JobRow {
  id: string;
  org_id: string;
  title: string;
  slug: string;
  status: string;
  deadline: string | null;
  org: { name: string } | null;
}

interface QuestionRow {
  id: string;
  question: string;
  is_required: boolean;
}

function fail(error: string, code?: SubmitResult["code"]): SubmitResult {
  return { ok: false, error, code };
}

/**
 * Load a job for the apply flow. Returns null when the job doesn't exist or
 * isn't accepting applications (not published / past deadline).
 */
export async function loadApplyJob(jobSlug: string): Promise<JobRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("jobs")
    .select("id,org_id,title,slug,status,deadline,org:organizations(name)")
    .eq("slug", jobSlug)
    .maybeSingle();
  if (error) throw new Error(`Failed to load job: ${error.message}`);
  const job = data as unknown as JobRow | null;
  if (!job || job.status !== "published") return null;
  if (job.deadline && new Date(job.deadline).getTime() <= Date.now()) return null;
  return job;
}

/**
 * Submit a job application: transactional-style insert into applications +
 * application_answers + application_documents (+ status history, consent
 * record, in-app notification). The partial unique index on
 * (user_id, job_id) WHERE withdrawn_at IS NULL blocks duplicate active
 * applications; a 23505 violation is mapped to a friendly message.
 */
export async function submitApplication(
  input: SubmitApplicationInput,
): Promise<SubmitResult> {
  const user = await requireCandidate();

  // SECURITY (H1/M3): Limit application velocity (20/day per user) to prevent
  // spam blasts and AI-generated mass applications.
  const { allowed, retryAfterSec } = await checkRateLimit("apply", user.id, 20, 86400);
  if (!allowed) {
    const hours = Math.ceil(retryAfterSec / 3600);
    return fail(
      `You've reached the daily application limit (20/day). Please try again in ~${hours} hour(s).`,
      "RATE_LIMITED",
    );
  }

  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first?.message ?? "Please check your answers and try again.");
  }
  const { jobSlug, answers, documentId, coverLetter } = parsed.data;

  const admin = createAdminClient();

  // Server-side job checks: exists, published, not past deadline.
  const job = await loadApplyJob(jobSlug);
  if (!job) {
    return fail(
      "This job is no longer accepting applications.",
      "JOB_CLOSED",
    );
  }

  // Duplicate active application → friendly message (also enforced by the
  // partial unique index as a race-safe backstop).
  const { data: existing } = await admin
    .from("applications")
    .select("id")
    .eq("user_id", user.id)
    .eq("job_id", job.id)
    .is("withdrawn_at", null)
    .maybeSingle();
  if (existing) {
    return fail("You've already applied to this job.", "ALREADY_APPLIED");
  }

  // Required questions must be answered (server-side source of truth).
  const { data: questions, error: qError } = await admin
    .from("job_questions")
    .select("id,question,is_required")
    .eq("job_id", job.id)
    .order("sort_order");
  if (qError) throw new Error(`Failed to load questions: ${qError.message}`);
  const qs = (questions ?? []) as QuestionRow[];
  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a.answer]));
  for (const q of qs) {
    if (q.is_required && !(answerByQuestion.get(q.id) ?? "").trim()) {
      return fail(`Please answer the required question: “${q.question}”.`);
    }
  }
  // Reject answers to questions that don't belong to this job.
  const questionIds = new Set(qs.map((q) => q.id));
  for (const a of answers) {
    if (!questionIds.has(a.questionId)) {
      return fail("Invalid question in your answers. Please reload and try again.");
    }
  }

  // The attached CV must belong to the candidate.
  const profile = await getOrCreateCandidateProfile(user.id);
  const { data: doc, error: docError } = await admin
    .from("candidate_documents")
    .select("id,storage_path,file_name,mime_type,size_bytes,profile_id")
    .eq("id", documentId)
    .maybeSingle();
  if (docError) throw new Error(`Failed to load CV: ${docError.message}`);
  const cv = doc as {
    id: string;
    storage_path: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    profile_id: string;
  } | null;
  if (!cv || cv.profile_id !== profile.id) {
    return fail("The selected CV could not be found. Please choose another.");
  }

  // Insert the application; map the partial-unique violation to a friendly
  // message in case of a race with the pre-check above.
  const { data: application, error: appError } = await admin
    .from("applications")
    .insert({
      user_id: user.id,
      job_id: job.id,
      org_id: job.org_id,
      document_id: cv.id,
      cover_letter: coverLetter?.trim() || null,
      stage: "applied",
      snapshot_title: job.title,
      snapshot_org_name: job.org?.name ?? null,
    })
    .select("id")
    .single();
  if (appError) {
    if (appError.code === "23505") {
      return fail("You've already applied to this job.", "ALREADY_APPLIED");
    }
    throw new Error(`Failed to submit application: ${appError.message}`);
  }
  const applicationId = (application as { id: string }).id;

  // Best-effort cleanup if a follow-up insert fails, so we don't leave a
  // half-built application behind.
  async function rollback(reason: string): Promise<never> {
    await admin.from("applications").delete().eq("id", applicationId);
    throw new Error(reason);
  }

  // Sequential inserts with best-effort rollback (see rollback() above) so a
  // failure never leaves a half-built application behind.
  if (answers.length > 0) {
    const { error } = await admin.from("application_answers").insert(
      answers
        .filter((a) => a.answer.trim() !== "")
        .map((a) => ({
          application_id: applicationId,
          question_id: a.questionId,
          question_text: qs.find((q) => q.id === a.questionId)?.question ?? "",
          answer: a.answer.trim(),
        })),
    );
    if (error) await rollback(`Failed to save answers: ${error.message}`);
  }

  const { error: docInsertError } = await admin
    .from("application_documents")
    .insert({
      application_id: applicationId,
      storage_path: cv.storage_path,
      file_name: cv.file_name,
      mime_type: cv.mime_type,
      size_bytes: cv.size_bytes,
    });
  if (docInsertError) {
    await rollback(`Failed to attach CV: ${docInsertError.message}`);
  }

  const { error: historyError } = await admin
    .from("application_status_history")
    .insert({
      application_id: applicationId,
      from_stage: null,
      to_stage: "applied",
      changed_by: user.id,
      reason: "Application submitted by candidate",
    });
  if (historyError) await rollback(`Failed to record status: ${historyError.message}`);

  const { error: consentError } = await admin.from("consent_records").insert({
    user_id: user.id,
    purpose: "job_application",
    granted: true,
    source: "apply_flow",
  });
  if (consentError) await rollback(`Failed to record consent: ${consentError.message}`);

  // Notification failure shouldn't fail the application itself.
  try {
    await createNotification({
      userId: user.id,
      type: "application_submitted",
      title: "Application submitted",
      body: `Your application for “${job.title}” at ${job.org?.name ?? "the employer"} was submitted.`,
      link: `/candidate/applications/${applicationId}`,
    });
  } catch {
    // In-app notification is best-effort here.
  }

  revalidatePath("/candidate/applications");
  revalidatePath("/candidate");
  revalidatePath("/candidate/notifications");
  return { ok: true, applicationId };
}
