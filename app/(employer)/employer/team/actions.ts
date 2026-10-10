"use server";

import { z } from "zod";
import { requireSessionUser } from "@/lib/auth";
import { requireOrgRole, type OrgRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { sendEmail, type EmailResult } from "@/lib/email";
import { getEnv } from "@/lib/env";
import {
  listOrgMembers,
  okResult,
  failResult,
  revalidateEmployer,
  singleRow,
  type ActionResult,
} from "../../_lib/org";

const INVITABLE_ROLES = ["org_admin", "hr_manager", "recruiter", "hiring_manager", "employee"] as const;

const inviteSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  role: z.enum(INVITABLE_ROLES),
  departmentId: z.string().uuid().nullable(),
  expiresInDays: z.number().int().min(1).max(30),
});

export type InviteInput = z.infer<typeof inviteSchema>;
export type InviteResult = ActionResult & {
  inviteUrl?: string;
  emailSent?: boolean;
  emailReason?: string;
};

function inviteUrlFor(token: string): string {
  const base = getEnv().NEXT_PUBLIC_APP_URL ?? "";
  return `${base}/invite/${token}`;
}

function emailSummary(result: EmailResult): { sent: boolean; reason?: string } {
  return result.sent ? { sent: true } : { sent: false, reason: result.reason };
}

/**
 * Invite a team member. Creates the organization_invitations row and attempts
 * an email honestly; the invite URL is always returned so it can be shared
 * manually when email is unconfigured.
 */
export async function inviteMember(orgId: string, input: InviteInput): Promise<InviteResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, ["org_admin", "hr_manager"]);
    const parsed = inviteSchema.parse(input);
    const admin = createAdminClient();

    const email = parsed.email.toLowerCase();
    // Don't invite someone who is already an active member.
    const { data: existingMember } = await admin
      .from("organization_memberships")
      .select("id,is_active,profiles!inner(email)")
      .eq("org_id", orgId)
      .eq("is_active", true);
    const alreadyMember = (existingMember ?? []).some(
      (m) => (singleRow(m.profiles as { email: string } | { email: string }[] | null)?.email ?? "").toLowerCase() === email,
    );
    if (alreadyMember) throw new Error("This person is already an active member of the organization.");

    // Reuse (refresh) a pending invitation for the same email+org instead of duplicating.
    const { data: pending } = await admin
      .from("organization_invitations")
      .select("id")
      .eq("org_id", orgId)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();
    if (pending) {
      const { error } = await admin
        .from("organization_invitations")
        .update({
          role: parsed.role,
          department_id: parsed.departmentId,
          expires_at: new Date(Date.now() + parsed.expiresInDays * 86_400_000).toISOString(),
          invited_by: user.id,
        })
        .eq("id", pending.id);
      if (error) throw new Error(`Failed to refresh invitation: ${error.message}`);
    }

    const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).single();

    let invitationId: string;
    let token: string;
    if (pending) {
      invitationId = pending.id as string;
      const { data: row } = await admin.from("organization_invitations").select("token").eq("id", invitationId).single();
      token = row?.token as string;
    } else {
      const { data: invitation, error } = await admin
        .from("organization_invitations")
        .insert({
          org_id: orgId,
          email,
          role: parsed.role,
          department_id: parsed.departmentId,
          invited_by: user.id,
          expires_at: new Date(Date.now() + parsed.expiresInDays * 86_400_000).toISOString(),
          status: "pending",
        })
        .select("id,token")
        .single();
      if (error || !invitation) throw new Error(`Failed to create invitation: ${error?.message ?? "unknown"}`);
      invitationId = invitation.id as string;
      token = invitation.token as string;
    }

    const url = inviteUrlFor(token);
    const emailResult = await sendEmail({
      to: email,
      subject: `You're invited to join ${org?.name ?? "an organization"} on Job Recruitment And Applicant Tracking System`,
      html: `<p>You've been invited to join <strong>${org?.name ?? "an organization"}</strong> as <strong>${parsed.role.replace("_", " ")}</strong>.</p><p><a href="${url}">Accept the invitation</a> (expires in ${parsed.expiresInDays} days).</p>`,
      text: `You've been invited to join ${org?.name ?? "an organization"} as ${parsed.role.replace("_", " ")}. Accept here: ${url} (expires in ${parsed.expiresInDays} days).`,
    });
    const summary = emailSummary(emailResult);

    await writeAudit({
      actorUserId: user.id,
      action: "team.invited",
      entityType: "organization_invitation",
      entityId: invitationId,
      orgId,
      metadata: { email, role: parsed.role, emailSent: summary.sent, emailReason: summary.reason ?? null },
    });
    revalidateEmployer();
    return { ok: true, inviteUrl: url, emailSent: summary.sent, emailReason: summary.reason };
  } catch (e) {
    return failResult(e);
  }
}

/** Resend an invitation: refresh expiry and retry the email honestly. */
export async function resendInvitation(orgId: string, invitationId: string): Promise<InviteResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, ["org_admin", "hr_manager"]);
    const admin = createAdminClient();
    const { data: invitation } = await admin
      .from("organization_invitations")
      .select("id,email,role,token,status,organizations(name)")
      .eq("id", invitationId)
      .eq("org_id", orgId)
      .single();
    if (!invitation) throw new Error("Invitation not found.");
    if ((invitation.status as string) !== "pending") throw new Error("Only pending invitations can be resent.");

    const { error } = await admin
      .from("organization_invitations")
      .update({ expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString() })
      .eq("id", invitationId);
    if (error) throw new Error(`Failed to resend: ${error.message}`);

    const url = inviteUrlFor(invitation.token as string);
    const orgName = singleRow(invitation.organizations as { name: string } | { name: string }[] | null)?.name ?? "an organization";
    const emailResult = await sendEmail({
      to: invitation.email as string,
      subject: `Reminder: you're invited to join ${orgName} on Job Recruitment And Applicant Tracking System`,
      html: `<p>This is a reminder of your invitation to join <strong>${orgName}</strong> as <strong>${(invitation.role as string).replace("_", " ")}</strong>.</p><p><a href="${url}">Accept the invitation</a> (expires in 7 days).</p>`,
      text: `Reminder: you're invited to join ${orgName} as ${(invitation.role as string).replace("_", " ")}. Accept here: ${url} (expires in 7 days).`,
    });
    const summary = emailSummary(emailResult);

    await writeAudit({
      actorUserId: user.id,
      action: "team.invitation_resent",
      entityType: "organization_invitation",
      entityId: invitationId,
      orgId,
      metadata: { emailSent: summary.sent },
    });
    revalidateEmployer();
    return { ok: true, inviteUrl: url, emailSent: summary.sent, emailReason: summary.reason };
  } catch (e) {
    return failResult(e);
  }
}

/** Revoke a pending invitation. */
export async function revokeInvitation(orgId: string, invitationId: string): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, ["org_admin", "hr_manager"]);
    const admin = createAdminClient();
    const { data: invitation } = await admin
      .from("organization_invitations")
      .select("id,status")
      .eq("id", invitationId)
      .eq("org_id", orgId)
      .single();
    if (!invitation) throw new Error("Invitation not found.");
    if ((invitation.status as string) !== "pending") throw new Error("Only pending invitations can be revoked.");

    const { error } = await admin
      .from("organization_invitations")
      .update({ status: "revoked" })
      .eq("id", invitationId);
    if (error) throw new Error(`Failed to revoke: ${error.message}`);

    await writeAudit({
      actorUserId: user.id,
      action: "team.invitation_revoked",
      entityType: "organization_invitation",
      entityId: invitationId,
      orgId,
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/**
 * Change a member's role. Org admins only; cannot escalate to super_admin
 * (not offered), cannot change your own role, and cannot demote the last
 * active org admin.
 */
export async function changeMemberRole(orgId: string, targetUserId: string, role: OrgRole): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, ["org_admin"]);
    if (!INVITABLE_ROLES.includes(role as (typeof INVITABLE_ROLES)[number])) {
      throw new Error("Invalid role.");
    }
    if (targetUserId === user.id) throw new Error("You cannot change your own role.");
    const admin = createAdminClient();

    const { data: membership } = await admin
      .from("organization_memberships")
      .select("id,is_active")
      .eq("org_id", orgId)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (!membership || !(membership.is_active as boolean)) {
      throw new Error("Target is not an active member of this organization.");
    }

    if (role !== "org_admin") {
      const members = await listOrgMembers(orgId);
      const activeAdmins = members.filter((m) => m.isActive && m.role === "org_admin");
      if (activeAdmins.length <= 1 && activeAdmins.some((m) => m.userId === targetUserId)) {
        throw new Error("Cannot demote the last active org admin.");
      }
    }

    // Replace org-scoped role grants for the target user.
    const { error: delError } = await admin
      .from("user_roles")
      .delete()
      .eq("user_id", targetUserId)
      .eq("org_id", orgId);
    if (delError) throw new Error(`Failed to update role: ${delError.message}`);
    const { error: insError } = await admin.from("user_roles").insert({
      user_id: targetUserId,
      org_id: orgId,
      role,
    });
    if (insError) throw new Error(`Failed to update role: ${insError.message}`);

    await writeAudit({
      actorUserId: user.id,
      action: "team.role_changed",
      entityType: "user",
      entityId: targetUserId,
      orgId,
      metadata: { newRole: role },
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/**
 * Remove a member: deactivates the membership (org_admin only). Cannot remove
 * yourself or the last active org admin.
 */
export async function removeMember(orgId: string, targetUserId: string): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, ["org_admin"]);
    if (targetUserId === user.id) throw new Error("You cannot remove yourself.");
    const admin = createAdminClient();

    const members = await listOrgMembers(orgId);
    const target = members.find((m) => m.userId === targetUserId && m.isActive);
    if (!target) throw new Error("Target is not an active member.");
    const activeAdmins = members.filter((m) => m.isActive && m.role === "org_admin");
    if (activeAdmins.length <= 1 && target.role === "org_admin") {
      throw new Error("Cannot remove the last active org admin.");
    }

    const { error } = await admin
      .from("organization_memberships")
      .update({ is_active: false })
      .eq("org_id", orgId)
      .eq("user_id", targetUserId);
    if (error) throw new Error(`Failed to remove member: ${error.message}`);

    await writeAudit({
      actorUserId: user.id,
      action: "team.member_removed",
      entityType: "user",
      entityId: targetUserId,
      orgId,
    });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Page data: members, pending invitations, departments (org-scoped). */
export async function getTeamPageData(orgId: string) {
  const user = await requireSessionUser();
  await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
  const admin = createAdminClient();
  const [members, { data: invitations }, { data: departments }] = await Promise.all([
    listOrgMembers(orgId),
    admin
      .from("organization_invitations")
      .select("id,email,role,status,expires_at,created_at,departments(name)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin.from("departments").select("id,name").eq("org_id", orgId).order("name"),
  ]);
  return {
    members,
    invitations: (invitations ?? []).map((i) => ({
      id: i.id as string,
      email: i.email as string,
      role: i.role as string,
      status: i.status as string,
      expiresAt: i.expires_at as string,
      departmentName: singleRow(i.departments as { name: string } | { name: string }[] | null)?.name ?? null,
    })),
    departments: (departments ?? []).map((d) => ({ id: d.id as string, name: d.name as string })),
    invitableRoles: [...INVITABLE_ROLES],
  };
}
