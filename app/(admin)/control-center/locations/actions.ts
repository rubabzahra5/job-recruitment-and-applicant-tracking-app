"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminContext } from "@/app/(admin)/_components/admin-server";
import type { ActionResult } from "@/app/(admin)/_components/action-buttons";
import { writeAudit } from "@/lib/audit";
import { PROVINCES } from "./provinces";

const locationSchema = z.object({
  city: z.string().trim().min(2, "City is required.").max(120),
  province: z.enum(PROVINCES),
  country: z.string().trim().min(2).max(120).default("Pakistan"),
});

export async function upsertLocation(
  input: z.infer<typeof locationSchema> & { id?: string },
): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const { id, ...rest } = locationSchema.extend({ id: z.string().uuid().optional() }).parse(input);
    const payload = { city: rest.city, province: rest.province, country: rest.country };
    let entityId: string;
    if (id) {
      const { error } = await admin.from("locations").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      entityId = id;
    } else {
      const { data, error } = await admin.from("locations").insert(payload).select("id").single();
      if (error || !data) throw new Error(error?.message ?? "Create failed.");
      entityId = data.id as string;
    }
    await writeAudit({
      actorUserId: user.id,
      action: id ? "location.updated" : "location.created",
      entityType: "location",
      entityId,
      metadata: { city: rest.city, province: rest.province },
    });
    revalidatePath("/control-center/locations");
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save location.";
    if (/duplicate|unique/i.test(message)) {
      return { ok: false, error: "That city + province combination already exists." };
    }
    return { ok: false, error: message };
  }
}

export async function deleteLocation(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const id = z.string().uuid().parse(payload.id);
    const { count } = await admin.from("jobs").select("id", { count: "exact", head: true }).eq("location_id", id);
    if ((count ?? 0) > 0) {
      return { ok: false, error: `Cannot delete: ${count} job(s) still reference this location. Reassign them first.` };
    }
    const { error } = await admin.from("locations").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await writeAudit({ actorUserId: user.id, action: "location.deleted", entityType: "location", entityId: id });
    revalidatePath("/control-center/locations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete location." };
  }
}
