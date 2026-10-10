"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminContext } from "@/app/(admin)/_components/admin-server";
import type { ActionResult } from "@/app/(admin)/_components/action-buttons";
import { writeAudit } from "@/lib/audit";

const slug = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only.");

const categorySchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(120),
  slug,
  icon: z.string().trim().max(60).optional(),
});

function fail(error: unknown, fallback: string): ActionResult {
  const message = error instanceof Error ? error.message : fallback;
  if (/duplicate|unique/i.test(message)) {
    return { ok: false, error: "Name or slug is already in use." };
  }
  return { ok: false, error: message };
}

export async function upsertCategory(
  input: z.infer<typeof categorySchema> & { id?: string },
): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const { id, ...rest } = categorySchema.extend({ id: z.string().uuid().optional() }).parse(input);
    const payload = { name: rest.name, slug: rest.slug, icon: rest.icon || null };
    let entityId: string;
    if (id) {
      const { error } = await admin.from("job_categories").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      entityId = id;
    } else {
      const { data, error } = await admin.from("job_categories").insert(payload).select("id").single();
      if (error || !data) throw new Error(error?.message ?? "Create failed.");
      entityId = data.id as string;
    }
    await writeAudit({
      actorUserId: user.id,
      action: id ? "category.updated" : "category.created",
      entityType: "job_category",
      entityId,
      metadata: { name: rest.name, slug: rest.slug },
    });
    revalidatePath("/control-center/categories");
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to save category.");
  }
}

export async function deleteCategory(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const id = z.string().uuid().parse(payload.id);
    const { count } = await admin.from("jobs").select("id", { count: "exact", head: true }).eq("category_id", id);
    if ((count ?? 0) > 0) {
      return { ok: false, error: `Cannot delete: ${count} job(s) still reference this category. Reassign them first.` };
    }
    const { error } = await admin.from("job_categories").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await writeAudit({ actorUserId: user.id, action: "category.deleted", entityType: "job_category", entityId: id });
    revalidatePath("/control-center/categories");
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to delete category.");
  }
}
