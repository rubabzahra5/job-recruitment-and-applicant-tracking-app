"use server";

import { z } from "zod";
import { requireSessionUser } from "@/lib/auth";
import { requireOrgRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import {
  getOrgSettings,
  okResult,
  failResult,
  revalidateEmployer,
  type ActionResult,
  type OrgSettings,
} from "../../_lib/org";

const settingsSchema = z.object({
  max_active_job_postings: z.number().int().min(1).max(10000).nullable(),
  default_deadline_days: z.number().int().min(1).max(365).nullable(),
  notify_recruiters_on_new_application: z.boolean(),
});

export type OrgSettingsInput = z.infer<typeof settingsSchema>;

/**
 * Update organization_settings (org_admin only). These settings are actually
 * consumed by app code:
 *  - max_active_job_postings → enforced when publishing jobs (jobs/actions.ts).
 *  - default_deadline_days → pre-fills the deadline in the job form.
 *  - notify_recruiters_on_new_application → contract for the candidate module:
 *    notify org recruiters in-app when a new application arrives.
 */
export async function updateOrgSettings(orgId: string, input: OrgSettingsInput): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, ["org_admin"]);
    const parsed = settingsSchema.parse(input);
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("organization_settings")
      .select("id,settings")
      .eq("org_id", orgId)
      .maybeSingle();
    const merged = { ...((existing?.settings as Record<string, unknown>) ?? {}), ...parsed };

    if (existing) {
      const { error } = await admin.from("organization_settings").update({ settings: merged }).eq("id", existing.id);
      if (error) throw new Error(`Failed to save settings: ${error.message}`);
    } else {
      const { error } = await admin.from("organization_settings").insert({ org_id: orgId, settings: merged });
      if (error) throw new Error(`Failed to save settings: ${error.message}`);
    }

    await writeAudit({
      actorUserId: user.id,
      action: "organization.settings_updated",
      entityType: "organization",
      entityId: orgId,
      orgId,
      metadata: { settings: parsed },
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Load settings for the page (org_admin/hr_manager). */
export async function getSettingsPageData(orgId: string): Promise<OrgSettings> {
  const user = await requireSessionUser();
  await requireOrgRole(user.id, orgId, ["org_admin", "hr_manager"]);
  return getOrgSettings(orgId);
}
