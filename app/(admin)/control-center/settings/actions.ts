"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminContext } from "@/app/(admin)/_components/admin-server";
import type { ActionResult } from "@/app/(admin)/_components/action-buttons";
import { writeAudit } from "@/lib/audit";
import { DEFAULTS, SETTING_SPECS } from "./settings-spec";

const settingsSchema = z.object({
  platform_name: z.string().trim().min(1, "Platform name is required.").max(120),
  operating_mode: z.enum(["centralized", "internal"]),
  currency: z.string().trim().min(1).max(10).regex(/^[A-Z]{3}$/, "Use a 3-letter ISO code, e.g. PKR."),
  timezone: z.string().trim().min(1, "Timezone is required.").max(60),
  registration_open: z.boolean(),
  employer_approval_required: z.boolean(),
  job_moderation_required: z.boolean(),
  max_active_applications_per_candidate: z.coerce.number().int().min(1).max(1000),
  cv_max_file_mb: z.coerce.number().int().min(1).max(100),
  cv_allowed_types: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(,[a-z0-9]+)*$/, "Comma-separated extensions, e.g. pdf,doc,docx."),
  data_retention_days: z.coerce.number().int().min(30).max(3650),
  notify_on_new_application: z.boolean(),
  notify_on_stage_change: z.boolean(),
  privacy_contact_email: z.string().trim().max(200).refine(
    (v) => v === "" || /.+@.+\..+/.test(v),
    "Enter a valid email or leave empty.",
  ),
  support_email: z.string().trim().max(200).refine(
    (v) => v === "" || /.+@.+\..+/.test(v),
    "Enter a valid email or leave empty.",
  ),
  support_phone: z.string().trim().max(30),
});

export type SettingsValues = z.infer<typeof settingsSchema>;

/** Load current platform settings, falling back to DEFAULTS for missing keys. */
export async function loadSettings(): Promise<Record<string, unknown>> {
  const { admin } = await adminContext();
  const { data, error } = await admin.from("platform_settings").select("key,value");
  if (error) throw new Error(`Failed to load settings: ${error.message}`);
  const current: Record<string, unknown> = { ...DEFAULTS };
  for (const row of data ?? []) {
    const key = row.key as string;
    if (key in DEFAULTS) current[key] = row.value as unknown;
  }
  return current;
}

export async function saveSettings(input: SettingsValues): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const data = settingsSchema.parse(input);

    const previous = await loadSettings();
    const changed: string[] = [];
    for (const spec of SETTING_SPECS) {
      const next = data[spec.key as keyof SettingsValues];
      if (JSON.stringify(previous[spec.key]) !== JSON.stringify(next)) {
        changed.push(spec.key);
        const { error } = await admin
          .from("platform_settings")
          .upsert({ key: spec.key, value: next as never }, { onConflict: "key" });
        if (error) throw new Error(`Failed to save ${spec.key}: ${error.message}`);
      }
    }

    await writeAudit({
      actorUserId: user.id,
      action: "platform_settings.updated",
      entityType: "platform_settings",
      entityId: null,
      metadata: { changed_keys: changed, values: data },
    });
    revalidatePath("/control-center/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save settings." };
  }
}
