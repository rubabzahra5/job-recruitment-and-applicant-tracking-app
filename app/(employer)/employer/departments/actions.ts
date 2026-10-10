"use server";

import { z } from "zod";
import { requireSessionUser } from "@/lib/auth";
import { requireOrgRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import {
  okResult,
  failResult,
  revalidateEmployer,
  type ActionResult,
} from "../../_lib/org";

const nameSchema = z.object({ name: z.string().trim().min(2, "Name must be at least 2 characters.").max(100) });

/** Create a department (org_admin/hr_manager). */
export async function createDepartment(orgId: string, name: string): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, ["org_admin", "hr_manager"]);
    const parsed = nameSchema.parse({ name });
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("departments")
      .insert({ org_id: orgId, name: parsed.name })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("A department with this name already exists.");
      throw new Error(`Failed to create department: ${error.message}`);
    }
    await writeAudit({ actorUserId: user.id, action: "department.created", entityType: "department", entityId: data.id as string, orgId });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Rename a department. */
export async function renameDepartment(orgId: string, departmentId: string, name: string): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, ["org_admin", "hr_manager"]);
    const parsed = nameSchema.parse({ name });
    const admin = createAdminClient();
    const { data: dept } = await admin.from("departments").select("id").eq("id", departmentId).eq("org_id", orgId).single();
    if (!dept) throw new Error("Department not found in this organization.");
    const { error } = await admin.from("departments").update({ name: parsed.name }).eq("id", departmentId);
    if (error) {
      if (error.code === "23505") throw new Error("A department with this name already exists.");
      throw new Error(`Failed to rename department: ${error.message}`);
    }
    await writeAudit({ actorUserId: user.id, action: "department.renamed", entityType: "department", entityId: departmentId, orgId });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Delete a department — blocked while jobs or members reference it. */
export async function deleteDepartment(orgId: string, departmentId: string): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, ["org_admin", "hr_manager"]);
    const admin = createAdminClient();
    const { data: dept } = await admin.from("departments").select("id").eq("id", departmentId).eq("org_id", orgId).single();
    if (!dept) throw new Error("Department not found in this organization.");

    const [{ count: jobCount }, { count: memberCount }] = await Promise.all([
      admin.from("jobs").select("id", { count: "exact", head: true }).eq("department_id", departmentId),
      admin.from("organization_memberships").select("id", { count: "exact", head: true }).eq("department_id", departmentId),
    ]);
    if ((jobCount ?? 0) > 0 || (memberCount ?? 0) > 0) {
      throw new Error(
        `Cannot delete: ${jobCount ?? 0} job(s) and ${memberCount ?? 0} member(s) reference this department. Reassign them first.`,
      );
    }

    const { error } = await admin.from("departments").delete().eq("id", departmentId).eq("org_id", orgId);
    if (error) throw new Error(`Failed to delete department: ${error.message}`);
    await writeAudit({ actorUserId: user.id, action: "department.deleted", entityType: "department", entityId: departmentId, orgId });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Departments with member/job counts (page helper). */
export async function getDepartmentsPageData(orgId: string) {
  const user = await requireSessionUser();
  await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
  const admin = createAdminClient();
  const { data: departments } = await admin
    .from("departments")
    .select("id,name")
    .eq("org_id", orgId)
    .order("name");
  const ids = (departments ?? []).map((d) => d.id as string);
  const [{ data: jobs }, { data: members }] = ids.length > 0
    ? await Promise.all([
        admin.from("jobs").select("department_id").in("department_id", ids),
        admin.from("organization_memberships").select("department_id").eq("org_id", orgId).in("department_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const jobCount = new Map<string, number>();
  for (const j of (jobs ?? []) as Array<{ department_id: string | null }>) {
    if (j.department_id) jobCount.set(j.department_id, (jobCount.get(j.department_id) ?? 0) + 1);
  }
  const memberCount = new Map<string, number>();
  for (const m of (members ?? []) as Array<{ department_id: string | null }>) {
    if (m.department_id) memberCount.set(m.department_id, (memberCount.get(m.department_id) ?? 0) + 1);
  }
  return (departments ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
    jobCount: jobCount.get(d.id as string) ?? 0,
    memberCount: memberCount.get(d.id as string) ?? 0,
  }));
}
