"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCandidate, getLocations } from "@/app/(candidate)/_lib/candidate-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/app/(candidate)/_components/form-helpers";
import { zodFieldErrors } from "@/app/(candidate)/_components/form-helpers";
import { EMPLOYMENT_TYPES } from "./_lib/employment-types";

export interface AlertFilters {
  keyword?: string;
  city?: string;
  category_id?: string;
  employment_type?: string;
}

const filtersSchema = z.object({
  keyword: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  category_id: z.string().uuid().optional().or(z.literal("")),
  employment_type: z.enum(EMPLOYMENT_TYPES).optional().or(z.literal("")),
});

const alertSchema = z.object({
  name: z.string().trim().min(2, "Give your alert a name.").max(120),
  filters: filtersSchema,
  is_active: z.boolean(),
});

export type AlertInput = z.infer<typeof alertSchema>;

export interface JobAlertRow {
  id: string;
  name: string;
  filters: AlertFilters;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
}

export interface JobCategoryRow {
  id: string;
  name: string;
  slug: string;
}

function fail(error: string, fieldErrors?: Record<string, string>): ActionResult {
  return { ok: false, error, fieldErrors };
}

function zodErrors(err: z.ZodError): Record<string, string> {
  return zodFieldErrors(err);
}

/** Normalize filters: drop empties; validate city/category against reference data. */
async function normalizeFilters(
  filters: z.infer<typeof filtersSchema>,
): Promise<AlertFilters | { error: string }> {
  const admin = createAdminClient();
  const out: AlertFilters = {};
  if (filters.keyword?.trim()) out.keyword = filters.keyword.trim();
  if (filters.city?.trim()) {
    const locations = await getLocations();
    const match = locations.find(
      (l) => l.city.toLowerCase() === filters.city!.trim().toLowerCase(),
    );
    if (!match) return { error: "Choose a city from the list." };
    out.city = match.city;
  }
  if (filters.category_id?.trim()) {
    const { data } = await admin
      .from("job_categories")
      .select("id")
      .eq("id", filters.category_id.trim())
      .maybeSingle();
    if (!data) return { error: "Unknown job category." };
    out.category_id = filters.category_id.trim();
  }
  if (filters.employment_type?.trim()) out.employment_type = filters.employment_type.trim();
  return out;
}

async function requireOwnedAlert(alertId: string) {
  const user = await requireCandidate();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("job_alerts")
    .select("id,user_id")
    .eq("id", alertId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load alert: ${error.message}`);
  const row = data as { id: string; user_id: string } | null;
  if (!row || row.user_id !== user.id) throw new Error("Alert not found.");
  return { admin, user };
}

export async function listAlerts(): Promise<JobAlertRow[]> {
  const user = await requireCandidate();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("job_alerts")
    .select("id,name,filters,is_active,last_run_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load job alerts: ${error.message}`);
  return ((data ?? []) as Array<Omit<JobAlertRow, "filters"> & { filters: unknown }>).map(
    (r) => ({ ...r, filters: (r.filters ?? {}) as AlertFilters }),
  );
}

export async function listCategories(): Promise<JobCategoryRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("job_categories")
    .select("id,name,slug")
    .order("name");
  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  return (data ?? []) as JobCategoryRow[];
}

export async function createAlert(input: AlertInput): Promise<ActionResult> {
  try {
    const parsed = alertSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields.", zodErrors(parsed.error));
    }
    const user = await requireCandidate();
    const admin = createAdminClient();
    const filters = await normalizeFilters(parsed.data.filters);
    if ("error" in filters) return fail(filters.error);

    const { error } = await admin.from("job_alerts").insert({
      user_id: user.id,
      name: parsed.data.name.trim(),
      filters,
      is_active: parsed.data.is_active,
    });
    if (error) throw new Error(`Failed to create alert: ${error.message}`);
    revalidatePath("/candidate/job-alerts");
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to create alert.");
  }
}

export async function updateAlert(
  alertId: string,
  input: AlertInput,
): Promise<ActionResult> {
  try {
    const parsed = alertSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields.", zodErrors(parsed.error));
    }
    const { admin } = await requireOwnedAlert(alertId);
    const filters = await normalizeFilters(parsed.data.filters);
    if ("error" in filters) return fail(filters.error);

    const { error } = await admin
      .from("job_alerts")
      .update({
        name: parsed.data.name.trim(),
        filters,
        is_active: parsed.data.is_active,
      })
      .eq("id", alertId);
    if (error) throw new Error(`Failed to update alert: ${error.message}`);
    revalidatePath("/candidate/job-alerts");
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to update alert.");
  }
}

export async function toggleAlert(
  alertId: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    const { admin } = await requireOwnedAlert(alertId);
    const { error } = await admin
      .from("job_alerts")
      .update({ is_active: isActive })
      .eq("id", alertId);
    if (error) throw new Error(`Failed to update alert: ${error.message}`);
    revalidatePath("/candidate/job-alerts");
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to update alert.");
  }
}

export async function deleteAlert(alertId: string): Promise<ActionResult> {
  try {
    const { admin } = await requireOwnedAlert(alertId);
    const { error } = await admin.from("job_alerts").delete().eq("id", alertId);
    if (error) throw new Error(`Failed to delete alert: ${error.message}`);
    revalidatePath("/candidate/job-alerts");
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to delete alert.");
  }
}
