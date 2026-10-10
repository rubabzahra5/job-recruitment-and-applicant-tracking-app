"use server";

import { requireSessionUser } from "@/lib/auth";
import { requireOrgRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { karachiWallClockToUTC } from "@/lib/format";
import {
  getOrgContext,
  getOrgJob,
  getOrgSettings,
  getPlatformSetting,
  okResult,
  failResult,
  revalidateEmployer,
  type ActionResult,
} from "../../_lib/org";
import { joinJobDescription, slugifyTitle } from "../../_lib/job-text";
import {
  jobPayloadSchema,
  assertJobTransition,
  type JobPayload,
} from "./job-schema";

interface JobRow {
  title: string;
  department_id: string | null;
  category_id: string | null;
  location_id: string | null;
  description: string;
  responsibilities: string | null;
  qualifications: string | null;
  skills: string[];
  experience_min_years: number | null;
  experience_max_years: number | null;
  education_level: string | null;
  employment_type: string;
  workplace: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: string;
  salary_disclosed: boolean;
  currency: string;
  openings: number;
  is_fresh_graduate_ok: boolean;
  deadline: string | null;
}

function toJobRow(p: JobPayload, orgId: string, createdBy: string): JobRow {
  const description = joinJobDescription({
    description: p.description,
    benefits: p.benefits,
    instructions: p.instructions,
  });
  let deadline: string | null = null;
  if (p.deadline) {
    const d = karachiWallClockToUTC(p.deadline);
    if (d.getTime() <= Date.now()) throw new Error("Application deadline must be in the future.");
    deadline = d.toISOString();
  }
  return {
    title: p.title,
    department_id: p.departmentId,
    category_id: p.categoryId,
    location_id: p.locationId,
    description,
    responsibilities: p.responsibilities || null,
    qualifications: p.qualifications || null,
    skills: p.skills,
    experience_min_years: p.experienceMin,
    experience_max_years: p.experienceMax,
    education_level: p.educationLevel || null,
    employment_type: p.employmentType,
    workplace: p.workplace,
    salary_min: p.salaryMin,
    salary_max: p.salaryMax,
    salary_period: p.salaryPeriod,
    salary_disclosed: p.salaryDisclosed,
    currency: "PKR",
    openings: p.openings,
    is_fresh_graduate_ok: p.isFreshGraduateOk,
    deadline,
  };
}

async function uniqueSlug(admin: ReturnType<typeof createAdminClient>, title: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const slug = slugifyTitle(title);
    const { data } = await admin.from("jobs").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
  }
  return `${slugifyTitle(title)}-${Date.now().toString(36)}`;
}

/** Create a job posting as a draft. */
export async function createJob(orgId: string, payload: JobPayload): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const parsed = jobPayloadSchema.parse(payload);
    const admin = createAdminClient();
    const row = toJobRow(parsed, orgId, user.id);
    const slug = await uniqueSlug(admin, parsed.title);

    const { data: job, error } = await admin
      .from("jobs")
      .insert({ ...row, org_id: orgId, slug, status: "draft", created_by: user.id })
      .select("id")
      .single();
    if (error || !job) throw new Error(`Failed to create job: ${error?.message ?? "unknown"}`);

    await replaceQuestionsAndSkills(admin, job.id as string, parsed);

    await writeAudit({
      actorUserId: user.id,
      action: "job.created",
      entityType: "job",
      entityId: job.id as string,
      orgId,
      metadata: { title: parsed.title },
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Update a job posting (draft/approved/rejected only; published jobs are edited via close+repost). */
export async function updateJob(orgId: string, jobId: string, payload: JobPayload): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const admin = createAdminClient();
    const existing = await getOrgJob(admin, jobId, orgId);
    if (!["draft", "rejected", "approved"].includes(existing.status as string)) {
      throw new Error("Only draft, rejected, or approved jobs can be edited. Pause or close a published job first.");
    }
    const parsed = jobPayloadSchema.parse(payload);
    const row = toJobRow(parsed, orgId, user.id);

    const { error } = await admin.from("jobs").update(row).eq("id", jobId).eq("org_id", orgId);
    if (error) throw new Error(`Failed to update job: ${error.message}`);

    await replaceQuestionsAndSkills(admin, jobId, parsed);

    await writeAudit({
      actorUserId: user.id,
      action: "job.updated",
      entityType: "job",
      entityId: jobId,
      orgId,
      metadata: { title: parsed.title },
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

async function replaceQuestionsAndSkills(
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
  parsed: JobPayload,
): Promise<void> {
  await Promise.all([
    admin.from("job_questions").delete().eq("job_id", jobId),
    admin.from("job_skills").delete().eq("job_id", jobId),
  ]);
  if (parsed.questions.length > 0) {
    const { error } = await admin.from("job_questions").insert(
      parsed.questions.map((q, i) => ({
        job_id: jobId,
        question: q.question,
        is_required: q.isRequired,
        sort_order: i,
      })),
    );
    if (error) throw new Error(`Failed to save questions: ${error.message}`);
  }
  if (parsed.skills.length > 0) {
    const { error } = await admin.from("job_skills").insert(
      parsed.skills.map((s) => ({ job_id: jobId, skill: s })),
    );
    if (error) throw new Error(`Failed to save skills: ${error.message}`);
  }
}

/**
 * Move a job through its status workflow (server-validated).
 * `to` is the target status; `note` is required for rejections.
 */
export async function transitionJob(
  jobId: string,
  to: string,
  orgId: string,
  note?: string,
): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    const admin = createAdminClient();
    const job = await getOrgJob(admin, jobId, orgId);
    const from = job.status as string;

    assertJobTransition(from, to);

    // Role rules per transition.
    if (to === "approved" || to === "rejected") {
      await requireOrgRole(user.id, orgId, ["org_admin", "hr_manager"]);
      if (to === "rejected" && !note?.trim()) throw new Error("A rejection note is required.");
    } else if (to === "published" || to === "paused" || to === "closed" || to === "archived") {
      await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    } else {
      await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    }

    // Moderation gate: with job_moderation_required, jobs must pass review.
    if (to === "published" && from === "draft") {
      const moderation = await getPlatformSetting<boolean>("job_moderation_required", true);
      if (moderation) {
        throw new Error("Job moderation is enabled: submit the job for review before publishing.");
      }
    }

    // Org posting cap (from organization_settings).
    if (to === "published") {
      const settings = await getOrgSettings(orgId);
      if (settings.max_active_job_postings !== null) {
        const { count } = await admin
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("status", "published");
        if ((count ?? 0) >= settings.max_active_job_postings) {
          throw new Error(
            `Posting limit reached (${settings.max_active_job_postings} active jobs). Close or archive a vacancy first, or raise the limit in Settings.`,
          );
        }
      }
    }

    const update: Record<string, unknown> = { status: to };
    if (to === "published") update.published_at = new Date().toISOString();

    const { error } = await admin.from("jobs").update(update).eq("id", jobId).eq("org_id", orgId);
    if (error) throw new Error(`Failed to update job status: ${error.message}`);

    if (to === "approved" || to === "rejected") {
      const { error: apprError } = await admin.from("job_approvals").insert({
        job_id: jobId,
        decided_by: user.id,
        decision: to,
        note: note?.trim() || null,
      });
      if (apprError) throw new Error(`Failed to record approval: ${apprError.message}`);
    }

    await writeAudit({
      actorUserId: user.id,
      action: "job.status_changed",
      entityType: "job",
      entityId: jobId,
      orgId,
      metadata: { from, to, note: note?.trim() || null },
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Delete a job that never went live (draft/rejected/archived). */
export async function deleteJob(jobId: string, orgId: string): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const admin = createAdminClient();
    const job = await getOrgJob(admin, jobId, orgId);
    if (!["draft", "rejected", "archived"].includes(job.status as string)) {
      throw new Error("Only draft, rejected, or archived jobs can be deleted.");
    }
    const { error } = await admin.from("jobs").delete().eq("id", jobId).eq("org_id", orgId);
    if (error) throw new Error(`Failed to delete job: ${error.message}`);
    await writeAudit({
      actorUserId: user.id,
      action: "job.deleted",
      entityType: "job",
      entityId: jobId,
      orgId,
      metadata: { title: job.title },
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Reference data for the job form (org-scoped departments + global catalogs). */
export async function getJobFormData(orgId: string) {
  const user = await requireSessionUser();
  await requireOrgRole(user.id, orgId, { atLeast: "employee" });
  const admin = createAdminClient();
  const [{ data: departments }, { data: categories }, { data: locations }, settings] = await Promise.all([
    admin.from("departments").select("id,name").eq("org_id", orgId).order("name"),
    admin.from("job_categories").select("id,name").order("name"),
    admin.from("locations").select("id,city,province").order("city"),
    getOrgSettings(orgId),
  ]);
  return {
    departments: (departments ?? []).map((d) => ({ id: d.id as string, name: d.name as string })),
    categories: (categories ?? []).map((c) => ({ id: c.id as string, name: c.name as string })),
    locations: (locations ?? []).map((l) => ({
      id: l.id as string,
      label: `${l.city as string}, ${l.province as string}`,
    })),
    defaultDeadlineDays: settings.default_deadline_days ?? 30,
  };
}

/** Load a job + questions for the edit form (org-scoped). */
export async function getJobForEdit(jobId: string, orgId: string) {
  const user = await requireSessionUser();
  await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
  const admin = createAdminClient();
  const job = await getOrgJob(admin, jobId, orgId);
  const { data: questions } = await admin
    .from("job_questions")
    .select("question,is_required")
    .eq("job_id", jobId)
    .order("sort_order");
  return {
    job,
    questions: (questions ?? []).map((q) => ({
      question: q.question as string,
      isRequired: q.is_required as boolean,
    })),
  };
}

/** Verify org context for pages (thin wrapper so pages stay small). */
export async function getJobsPageContext(requestedOrgId: string | null) {
  return getOrgContext(requestedOrgId);
}
