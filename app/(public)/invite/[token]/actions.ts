"use server";

import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { okResult, failResult, singleRow, type ActionResult } from "../../../(employer)/_lib/org";

export interface InvitationView {
  token: string;
  orgName: string;
  role: string;
  departmentName: string | null;
  expiresAt: string;
  status: "pending" | "accepted" | "expired" | "revoked" | "invalid";
  alreadyMember: boolean;
}

/**
 * Load an invitation for the acceptance page. Expired pending invitations are
 * marked expired as a side effect (honest state, no silent acceptance).
 */
export async function getInvitation(token: string): Promise<InvitationView> {
  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from("organization_invitations")
    .select("id,org_id,email,role,expires_at,accepted_at,status,organizations(name),departments(name)")
    .eq("token", token)
    .maybeSingle();

  if (!invitation) {
    return { token, orgName: "", role: "", departmentName: null, expiresAt: "", status: "invalid", alreadyMember: false };
  }

  let status = invitation.status as InvitationView["status"];
  if (status === "pending" && new Date(invitation.expires_at as string).getTime() <= Date.now()) {
    await admin.from("organization_invitations").update({ status: "expired" }).eq("id", invitation.id);
    status = "expired";
  }

  let alreadyMember = false;
  try {
    const user = await requireSessionUser();
    const { data: membership } = await admin
      .from("organization_memberships")
      .select("id")
      .eq("org_id", invitation.org_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    alreadyMember = !!membership;
  } catch {
    // Not signed in — the page redirects to login.
  }

  return {
    token,
    orgName: singleRow(invitation.organizations as { name: string } | { name: string }[] | null)?.name ?? "the organization",
    role: invitation.role as string,
    departmentName: singleRow(invitation.departments as { name: string } | { name: string }[] | null)?.name ?? null,
    expiresAt: invitation.expires_at as string,
    status,
    alreadyMember,
  };
}

/**
 * Accept an invitation: creates the organization_memberships row and the
 * user_roles row, then marks the invitation accepted. Idempotent for the
 * already-a-member case.
 */
export async function acceptInvitation(token: string): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    const admin = createAdminClient();
    const { data: invitation } = await admin
      .from("organization_invitations")
      .select("id,org_id,email,role,department_id,expires_at,status")
      .eq("token", token)
      .maybeSingle();
    if (!invitation) throw new Error("Invitation not found.");
    if ((invitation.status as string) !== "pending") {
      throw new Error(`This invitation is ${(invitation.status as string)}.`);
    }
    if (new Date(invitation.expires_at as string).getTime() <= Date.now()) {
      await admin.from("organization_invitations").update({ status: "expired" }).eq("id", invitation.id);
      throw new Error("This invitation has expired.");
    }

    // The invitation is addressed to an email; accept only when it matches the
    // signed-in user's email (prevents token forwarding to another account).
    const { data: profile } = await admin.from("profiles").select("email").eq("id", user.id).single();
    const inviteEmail = (invitation.email as string).toLowerCase();
    const userEmail = ((profile?.email as string) ?? "").toLowerCase();
    if (userEmail !== inviteEmail) {
      throw new Error(
        `This invitation was sent to ${invitation.email as string}. Sign in with that account to accept it.`,
      );
    }

    const orgId = invitation.org_id as string;
    const role = invitation.role as string;

    // Membership (idempotent).
    const { data: existingMembership } = await admin
      .from("organization_memberships")
      .select("id,is_active")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existingMembership) {
      if (!(existingMembership.is_active as boolean)) {
        const { error } = await admin
          .from("organization_memberships")
          .update({ is_active: true, department_id: (invitation.department_id as string | null) ?? null })
          .eq("id", existingMembership.id);
        if (error) throw new Error(`Failed to reactivate membership: ${error.message}`);
      }
    } else {
      const { data: membership, error: mErr } = await admin
        .from("organization_memberships")
        .insert({
          org_id: orgId,
          user_id: user.id,
          department_id: (invitation.department_id as string | null) ?? null,
          is_active: true,
        })
        .select("id")
        .single();
      if (mErr || !membership) throw new Error(`Failed to create membership: ${mErr?.message ?? "unknown"}`);
    }

    // Role grant — roll back the membership insert if this fails and we created it.
    const { data: existingRole } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .eq("role", role)
      .maybeSingle();
    if (!existingRole) {
      const { error: rErr } = await admin.from("user_roles").insert({
        user_id: user.id,
        org_id: orgId,
        role,
      });
      if (rErr) {
        if (!existingMembership) {
          await admin.from("organization_memberships").delete().eq("org_id", orgId).eq("user_id", user.id);
        }
        throw new Error(`Failed to grant role: ${rErr.message}`);
      }
    }

    await admin
      .from("organization_invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    await writeAudit({
      actorUserId: user.id,
      action: "team.invitation_accepted",
      entityType: "organization_invitation",
      entityId: invitation.id as string,
      orgId,
      metadata: { role },
    });

    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

/** Where to send the user after accepting (first employer page). */
export async function invitationRedirect(token: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.from("organization_invitations").select("org_id").eq("token", token).maybeSingle();
  const orgId = data?.org_id as string | undefined;
  redirect(`/employer${orgId ? `?org=${encodeURIComponent(orgId)}` : ""}`);
}
