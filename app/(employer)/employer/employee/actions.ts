"use server";

import { z } from "zod";
import { notFound } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { requireOrgRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import {
  getOrgContext,
  getPlatformSetting,
  listOrgMembers,
  okResult,
  failResult,
  revalidateEmployer,
  singleRow,
  type ActionResult,
} from "../../_lib/org";

/**
 * Minimal employee self-service portal.
 *
 * Gated by the platform_settings flag `employee_portal_enabled` (checked
 * server-side on every page/action; 404 when disabled).
 *
 * Design notes (schema has no dedicated employee tables):
 *  - profile → profiles.display_name + organization_memberships.title/department
 *  - documents → the employee's own uploaded candidate_documents (CVs etc.)
 *  - requests → HR requests are delivered as in-app notifications to org
 *    admins/HR managers (type 'hr_request'); the employee keeps a
 *    'hr_request_sent' confirmation notification per request for the list view.
 *  - settings → notification_preferences (real table).
 */

export async function requireEmployeePortal(orgId: string): Promise<void> {
  const enabled = await getPlatformSetting<boolean>("employee_portal_enabled", false);
  if (!enabled) notFound();
  const user = await requireSessionUser();
  await requireOrgRole(user.id, orgId, { atLeast: "employee" });
}

export interface EmployeeHomeData {
  displayName: string | null;
  email: string;
  title: string | null;
  departmentName: string | null;
  role: string | null;
  orgName: string;
}

export async function getEmployeeHome(orgId: string): Promise<EmployeeHomeData> {
  await requireEmployeePortal(orgId);
  const ctx = await getOrgContext(orgId);
  const admin = createAdminClient();
  const [{ data: profile }, { data: membership }] = await Promise.all([
    admin.from("profiles").select("display_name,email").eq("id", ctx.user.id).single(),
    admin
      .from("organization_memberships")
      .select("title,departments(name)")
      .eq("org_id", orgId)
      .eq("user_id", ctx.user.id)
      .maybeSingle(),
  ]);
  return {
    displayName: (profile?.display_name as string | null) ?? null,
    email: (profile?.email as string) ?? "",
    title: (membership?.title as string | null) ?? null,
    departmentName: singleRow(membership?.departments as { name: string } | { name: string }[] | null)?.name ?? null,
    role: ctx.role,
    orgName: ctx.org.name,
  };
}

const employeeProfileSchema = z.object({
  displayName: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
  title: z.string().trim().max(120).nullable(),
});

/** Update permitted employee fields: display name + job title. */
export async function updateEmployeeProfile(orgId: string, input: { displayName: string; title: string | null }): Promise<ActionResult> {
  try {
    await requireEmployeePortal(orgId);
    const user = await requireSessionUser();
    const parsed = employeeProfileSchema.parse(input);
    const admin = createAdminClient();

    const [{ error: pErr }, { error: mErr }] = await Promise.all([
      admin.from("profiles").update({ display_name: parsed.displayName }).eq("id", user.id),
      admin
        .from("organization_memberships")
        .update({ title: parsed.title || null })
        .eq("org_id", orgId)
        .eq("user_id", user.id),
    ]);
    if (pErr) throw new Error(`Failed to update profile: ${pErr.message}`);
    if (mErr) throw new Error(`Failed to update title: ${mErr.message}`);

    await writeAudit({ actorUserId: user.id, action: "employee.profile_updated", entityType: "user", entityId: user.id, orgId });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** The employee's own uploaded documents (CVs etc.) with download links. */
export async function getEmployeeDocuments(orgId: string) {
  await requireEmployeePortal(orgId);
  const user = await requireSessionUser();
  const admin = createAdminClient();
  const { data: profile } = await admin.from("candidate_profiles").select("id").eq("user_id", user.id).maybeSingle();
  if (!profile) return [];
  const { data: docs } = await admin
    .from("candidate_documents")
    .select("id,file_name,mime_type,size_bytes,kind,created_at,storage_path")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });
  return (docs ?? []).map((d) => ({
    id: d.id as string,
    fileName: d.file_name as string,
    mimeType: d.mime_type as string,
    sizeBytes: d.size_bytes as number,
    kind: d.kind as string,
    createdAt: d.created_at as string,
  }));
}

export type DocUrlResult = { ok: true; url: string } | { ok: false; error: string };

/** Signed download URL for the employee's OWN document. */
export async function getEmployeeDocumentUrl(orgId: string, documentId: string): Promise<DocUrlResult> {
  try {
    await requireEmployeePortal(orgId);
    const user = await requireSessionUser();
    const admin = createAdminClient();
    const { data: doc } = await admin
      .from("candidate_documents")
      .select("storage_path,candidate_profiles!inner(user_id)")
      .eq("id", documentId)
      .single();
    if (!doc || singleRow(doc.candidate_profiles as { user_id: string } | { user_id: string }[] | null)?.user_id !== user.id) {
      return { ok: false, error: "Document not found." };
    }
    const objectPath = (doc.storage_path as string).replace(/^cvs\//, "");
    const { data, error } = await admin.storage.from("cvs").createSignedUrl(objectPath, 600);
    if (error || !data?.signedUrl) return { ok: false, error: "Could not generate a download link." };
    return { ok: true, url: data.signedUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

const requestSchema = z.object({
  subject: z.string().trim().min(3, "Subject must be at least 3 characters.").max(150),
  message: z.string().trim().min(10, "Describe your request (at least 10 characters).").max(2000),
});

/**
 * Create an HR request: notifies all org admins/HR managers in-app and stores
 * a confirmation notification for the employee (used by the list view).
 */
export async function sendHrRequest(orgId: string, input: { subject: string; message: string }): Promise<ActionResult> {
  try {
    await requireEmployeePortal(orgId);
    const ctx = await getOrgContext(orgId);
    const parsed = requestSchema.parse(input);
    const admin = createAdminClient();

    const { data: profile } = await admin.from("profiles").select("display_name,email").eq("id", ctx.user.id).single();
    const requester = (profile?.display_name as string | null) ?? (profile?.email as string) ?? "Employee";

    const members = await listOrgMembers(orgId);
    const hrStaff = members.filter((m) => m.isActive && ["org_admin", "hr_manager"].includes(m.role ?? ""));
    if (hrStaff.length === 0) throw new Error("No HR staff found in this organization.");

    for (const s of hrStaff) {
      await createNotification({
        userId: s.userId,
        type: "hr_request",
        title: `HR request: ${parsed.subject}`,
        body: `From ${requester}: ${parsed.message.slice(0, 300)}`,
        link: `/employer/team?org=${encodeURIComponent(orgId)}`,
      }).catch(() => undefined);
    }
    // Confirmation copy for the employee's own list.
    await createNotification({
      userId: ctx.user.id,
      type: "hr_request_sent",
      title: `HR request sent: ${parsed.subject}`,
      body: parsed.message.slice(0, 300),
    });

    await writeAudit({
      actorUserId: ctx.user.id,
      action: "employee.hr_request_sent",
      entityType: "user",
      entityId: ctx.user.id,
      orgId,
      metadata: { subject: parsed.subject },
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** The employee's sent HR requests (from their confirmation notifications). */
export async function getHrRequests(orgId: string) {
  await requireEmployeePortal(orgId);
  const user = await requireSessionUser();
  const admin = createAdminClient();
  const { data } = await admin
    .from("notifications")
    .select("id,title,body,created_at")
    .eq("user_id", user.id)
    .eq("type", "hr_request_sent")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((n) => ({
    id: n.id as string,
    title: n.title as string,
    body: n.body as string | null,
    createdAt: n.created_at as string,
  }));
}

export interface NotificationPrefs {
  inAppEnabled: boolean;
  emailEnabled: boolean;
}

/** Load notification preferences (defaults when no row exists). */
export async function getNotificationPrefs(orgId: string): Promise<NotificationPrefs> {
  await requireEmployeePortal(orgId);
  const user = await requireSessionUser();
  const admin = createAdminClient();
  const { data } = await admin
    .from("notification_preferences")
    .select("prefs")
    .eq("user_id", user.id)
    .maybeSingle();
  const prefs = (data?.prefs as Record<string, unknown>) ?? {};
  return {
    inAppEnabled: prefs.in_app_enabled !== false,
    emailEnabled: prefs.email_enabled !== false,
  };
}

/** Save notification preferences (upsert). */
export async function updateNotificationPrefs(orgId: string, prefs: NotificationPrefs): Promise<ActionResult> {
  try {
    await requireEmployeePortal(orgId);
    const user = await requireSessionUser();
    const admin = createAdminClient();
    const { error } = await admin.from("notification_preferences").upsert(
      {
        user_id: user.id,
        prefs: { in_app_enabled: prefs.inAppEnabled, email_enabled: prefs.emailEnabled },
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(`Failed to save preferences: ${error.message}`);
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}
