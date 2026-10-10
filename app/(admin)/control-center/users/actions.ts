"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminContext, ensureNotLastActiveSuperAdmin } from "@/app/(admin)/_components/admin-server";
import type { ActionResult } from "@/app/(admin)/_components/action-buttons";
import { writeAudit } from "@/lib/audit";

const ALL_ROLES = [
  "super_admin",
  "org_admin",
  "hr_manager",
  "recruiter",
  "hiring_manager",
  "employee",
  "candidate",
] as const;
const ORG_ROLES = ["org_admin", "hr_manager", "recruiter", "hiring_manager", "employee"] as const;

function fail(error: unknown, fallback: string): ActionResult {
  const message = error instanceof Error ? error.message : fallback;
  if (/duplicate|unique/i.test(message)) {
    return { ok: false, error: "That role grant already exists for this user." };
  }
  return { ok: false, error: message };
}

const assignSchema = z.object({
  role: z.enum(ALL_ROLES),
  orgId: z.string().uuid().optional(),
  /** Typed confirmation required when granting super_admin. */
  confirmation: z.string().optional(),
});

export async function assignRole(
  targetUserId: string,
  input: z.infer<typeof assignSchema>,
): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const data = assignSchema.parse(input);
    const target = z.string().uuid().parse(targetUserId);

    if (data.role === "super_admin") {
      // Only an existing super admin can grant super_admin (all control-center
      // callers are super admins — verified by adminContext), AND the granter
      // must type an explicit confirmation phrase (enforced client-side, re-checked here).
      if (data.confirmation !== "GRANT SUPER ADMIN") {
        return { ok: false, error: "Type GRANT SUPER ADMIN to confirm this grant." };
      }
      if (data.orgId) {
        return { ok: false, error: "super_admin is platform-wide and cannot be scoped to an organization." };
      }
    } else if (data.role !== "candidate") {
      if (!data.orgId) return { ok: false, error: "Organization roles require an organization." };
      // Grant requires an active membership (rbac: roles are only effective with one).
      const { data: membership, error: mErr } = await admin
        .from("organization_memberships")
        .select("id")
        .eq("org_id", data.orgId)
        .eq("user_id", target)
        .eq("is_active", true)
        .maybeSingle();
      if (mErr) throw new Error(mErr.message);
      if (!membership) {
        return { ok: false, error: "The user needs an active membership in that organization first." };
      }
    }

    const { error } = await admin.from("user_roles").insert({
      user_id: target,
      org_id: data.role === "super_admin" || data.role === "candidate" ? null : (data.orgId ?? null),
      role: data.role,
    });
    if (error) throw new Error(error.message);

    await writeAudit({
      actorUserId: user.id,
      action: "role.granted",
      entityType: "user_role",
      entityId: null,
      orgId: data.orgId ?? null,
      metadata: { user_id: target, role: data.role, via: "control-center" },
    });
    revalidatePath("/control-center/users");
    revalidatePath(`/control-center/users/${target}`);
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to assign role.");
  }
}

export async function revokeRole(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const grantId = z.string().uuid().parse(payload.grantId);
    const targetUserId = z.string().uuid().parse(payload.targetUserId);
    const { data: grant, error: gErr } = await admin
      .from("user_roles")
      .select("role,org_id")
      .eq("id", grantId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!grant) return { ok: false, error: "Role grant not found." };
    if (grant.role === "super_admin" && !grant.org_id) {
      await ensureNotLastActiveSuperAdmin(admin, targetUserId);
    }
    const { error } = await admin.from("user_roles").delete().eq("id", grantId);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: user.id,
      action: "role.revoked",
      entityType: "user_role",
      entityId: grantId,
      orgId: (grant.org_id as string) ?? null,
      metadata: { user_id: targetUserId, role: grant.role, via: "control-center" },
    });
    revalidatePath("/control-center/users");
    revalidatePath(`/control-center/users/${targetUserId}`);
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to revoke role.");
  }
}

export async function suspendUser(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const targetUserId = z.string().uuid().parse(payload.targetUserId);
    if (targetUserId === user.id) {
      return { ok: false, error: "You cannot suspend your own account." };
    }
    await ensureNotLastActiveSuperAdmin(admin, targetUserId);
    const { error } = await admin
      .from("profiles")
      .update({ is_active: false })
      .eq("id", targetUserId);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: user.id,
      action: "user.suspended",
      entityType: "user",
      entityId: targetUserId,
      metadata: { via: "control-center" },
    });
    revalidatePath("/control-center/users");
    revalidatePath(`/control-center/users/${targetUserId}`);
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to suspend user.");
  }
}

export async function reactivateUser(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const targetUserId = z.string().uuid().parse(payload.targetUserId);
    const { error } = await admin
      .from("profiles")
      .update({ is_active: true })
      .eq("id", targetUserId);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: user.id,
      action: "user.reactivated",
      entityType: "user",
      entityId: targetUserId,
      metadata: { via: "control-center" },
    });
    revalidatePath("/control-center/users");
    revalidatePath(`/control-center/users/${targetUserId}`);
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to reactivate user.");
  }
}

/**
 * Initiate a password reset via the real Supabase flow.
 * Returns the recovery action link for the admin to deliver manually.
 * Honest status: Supabase generates the link; no email is claimed as sent
 * (delivery depends on the project's SMTP configuration).
 */
export async function initiatePasswordReset(
  payload: Record<string, string>,
): Promise<ActionResult & { link?: string }> {
  try {
    const { user, admin } = await adminContext();
    const targetUserId = z.string().uuid().parse(payload.targetUserId);
    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("email")
      .eq("id", targetUserId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile?.email) return { ok: false, error: "No email on this account." };
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: profile.email as string,
    });
    if (error || !data?.properties?.action_link) {
      throw new Error(error?.message ?? "Failed to generate recovery link.");
    }
    await writeAudit({
      actorUserId: user.id,
      action: "auth.password_reset_initiated",
      entityType: "user",
      entityId: targetUserId,
      metadata: { via: "control-center", note: "recovery link generated; no email claimed as sent" },
    });
    return { ok: true, link: data.properties.action_link as string };
  } catch (e) {
    return fail(e, "Failed to initiate password reset.");
  }
}

const inviteSchema = z.object({
  orgId: z.string().uuid("Select an organization."),
  email: z.string().trim().email("Enter a valid email address."),
  role: z.enum(ORG_ROLES),
});

export async function createInvitation(
  input: z.infer<typeof inviteSchema>,
): Promise<ActionResult & { token?: string }> {
  try {
    const { user, admin } = await adminContext();
    const data = inviteSchema.parse(input);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: invite, error } = await admin
      .from("organization_invitations")
      .insert({
        org_id: data.orgId,
        email: data.email.toLowerCase(),
        role: data.role,
        invited_by: user.id,
        expires_at: expiresAt,
        status: "pending",
      })
      .select("id,token")
      .single();
    if (error || !invite) throw new Error(error?.message ?? "Create failed.");
    await writeAudit({
      actorUserId: user.id,
      action: "invitation.created",
      entityType: "organization_invitation",
      entityId: invite.id as string,
      orgId: data.orgId,
      metadata: { email: data.email, role: data.role, expires_at: expiresAt },
    });
    revalidatePath("/control-center/users");
    return { ok: true, token: invite.token as string };
  } catch (e) {
    return fail(e, "Failed to create invitation.");
  }
}

export async function resendInvitation(payload: Record<string, string>): Promise<ActionResult & { token?: string }> {
  try {
    const { user, admin } = await adminContext();
    const id = z.string().uuid().parse(payload.invitationId);
    const { data: existing, error: gErr } = await admin
      .from("organization_invitations")
      .select("id,email,org_id,status")
      .eq("id", id)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!existing) return { ok: false, error: "Invitation not found." };
    if (existing.status !== "pending") return { ok: false, error: "Only pending invitations can be resent." };
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin
      .from("organization_invitations")
      .update({ expires_at: expiresAt })
      .eq("id", id)
      .select("token")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Resend failed.");
    await writeAudit({
      actorUserId: user.id,
      action: "invitation.resent",
      entityType: "organization_invitation",
      entityId: id,
      orgId: existing.org_id as string,
      metadata: { email: existing.email, expires_at: expiresAt },
    });
    revalidatePath("/control-center/users");
    return { ok: true, token: data.token as string };
  } catch (e) {
    return fail(e, "Failed to resend invitation.");
  }
}

export async function revokeInvitation(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const id = z.string().uuid().parse(payload.invitationId);
    const { data: existing } = await admin
      .from("organization_invitations")
      .select("org_id")
      .eq("id", id)
      .maybeSingle();
    const { error } = await admin
      .from("organization_invitations")
      .update({ status: "revoked" })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: user.id,
      action: "invitation.revoked",
      entityType: "organization_invitation",
      entityId: id,
      orgId: (existing?.org_id as string) ?? null,
      metadata: { via: "control-center" },
    });
    revalidatePath("/control-center/users");
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to revoke invitation.");
  }
}

const provisionSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  displayName: z.string().trim().min(2, "Display name is required.").max(120),
  role: z.enum(["candidate", "super_admin"]),
  confirmation: z.string().optional(),
});

/**
 * Direct provisioning: creates the auth user (email confirmed) plus profile,
 * assigns the chosen platform role, and returns a recovery link for the admin
 * to deliver. The link is the honest handoff — no email is claimed as sent.
 */
export async function provisionUser(
  input: z.infer<typeof provisionSchema>,
): Promise<ActionResult & { link?: string }> {
  try {
    const { user, admin } = await adminContext();
    const data = provisionSchema.parse(input);
    if (data.role === "super_admin" && input.confirmation !== "GRANT SUPER ADMIN") {
      return { ok: false, error: "Type GRANT SUPER ADMIN to confirm this grant." };
    }
    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email.toLowerCase(),
      email_confirm: true,
      user_metadata: { display_name: data.displayName },
    });
    if (error || !created?.user) throw new Error(error?.message ?? "Provisioning failed.");
    const newId = created.user.id as string;
    const { error: roleError } = await admin
      .from("user_roles")
      .insert({ user_id: newId, org_id: null, role: data.role });
    if (roleError) throw new Error(roleError.message);
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: data.email.toLowerCase(),
    });
    if (linkError) throw new Error(linkError.message);
    await writeAudit({
      actorUserId: user.id,
      action: "user.provisioned",
      entityType: "user",
      entityId: newId,
      metadata: { email: data.email, role: data.role, via: "control-center" },
    });
    revalidatePath("/control-center/users");
    return { ok: true, link: linkData?.properties?.action_link as string | undefined };
  } catch (e) {
    return fail(e, "Failed to provision user.");
  }
}
