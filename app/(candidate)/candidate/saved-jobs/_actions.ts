"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCandidate } from "@/app/(candidate)/_lib/candidate-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/app/(candidate)/_components/form-helpers";

const jobIdSchema = z.string().uuid("Invalid job.");

export interface ToggleSaveResult extends ActionResult {
  saved?: boolean;
}

/**
 * Toggle a saved job for the signed-in candidate.
 * Exported for reuse by job cards on the public job board.
 */
export async function toggleSaveJob(jobId: string): Promise<ToggleSaveResult> {
  try {
    const parsed = jobIdSchema.safeParse(jobId);
    if (!parsed.success) return { ok: false, error: "Invalid job." };
    const user = await requireCandidate();
    const admin = createAdminClient();

    const { data: job } = await admin
      .from("jobs")
      .select("id")
      .eq("id", parsed.data)
      .maybeSingle();
    if (!job) return { ok: false, error: "Job not found." };

    const { data: existing } = await admin
      .from("saved_jobs")
      .select("id")
      .eq("user_id", user.id)
      .eq("job_id", parsed.data)
      .maybeSingle();

    if (existing) {
      const { error } = await admin
        .from("saved_jobs")
        .delete()
        .eq("user_id", user.id)
        .eq("job_id", parsed.data);
      if (error) throw new Error(`Failed to unsave job: ${error.message}`);
      revalidatePath("/candidate/saved-jobs");
      return { ok: true, saved: false };
    }

    const { error } = await admin.from("saved_jobs").insert({
      user_id: user.id,
      job_id: parsed.data,
    });
    if (error) throw new Error(`Failed to save job: ${error.message}`);
    revalidatePath("/candidate/saved-jobs");
    return { ok: true, saved: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save job." };
  }
}

/** Remove a saved job (ownership-scoped delete). */
export async function unsaveJob(jobId: string): Promise<ActionResult> {
  try {
    const parsed = jobIdSchema.safeParse(jobId);
    if (!parsed.success) return { ok: false, error: "Invalid job." };
    const user = await requireCandidate();
    const admin = createAdminClient();
    const { error } = await admin
      .from("saved_jobs")
      .delete()
      .eq("user_id", user.id)
      .eq("job_id", parsed.data);
    if (error) throw new Error(`Failed to remove saved job: ${error.message}`);
    revalidatePath("/candidate/saved-jobs");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to remove saved job." };
  }
}

export interface SavedJobRow {
  id: string;
  created_at: string;
  job: {
    id: string;
    title: string;
    slug: string;
    status: string;
    deadline: string | null;
    employment_type: string;
    salary_min: number | null;
    salary_max: number | null;
    salary_period: string;
    salary_disclosed: boolean;
    org: { name: string } | null;
    location: { city: string; province: string } | null;
  } | null;
}

/** The candidate's saved jobs, newest first (user_id = auth.uid()). */
export async function listSavedJobs(): Promise<SavedJobRow[]> {
  const user = await requireCandidate();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("saved_jobs")
    .select(
      "id,created_at,job:jobs(id,title,slug,status,deadline,employment_type,salary_min,salary_max,salary_period,salary_disclosed,org:organizations(name),location:locations(city,province))",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load saved jobs: ${error.message}`);
  return (data ?? []) as unknown as SavedJobRow[];
}
