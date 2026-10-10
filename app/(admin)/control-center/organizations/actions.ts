"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminContext } from "@/app/(admin)/_components/admin-server";
import type { ActionResult } from "@/app/(admin)/_components/action-buttons";
import { writeAudit } from "@/lib/audit";
import { normalizePhone } from "@/lib/phone";

const slugSchema = z
  .string()
  .trim()
  .min(2, "Slug must be at least 2 characters.")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug may only contain lowercase letters, numbers and hyphens.");

const orgSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(200),
  slug: slugSchema,
  industry: z.string().trim().max(120).optional(),
  website: z.string().trim().max(200).optional(),
  contact_email: z.string().trim().email("Enter a valid contact email.").max(200).or(z.literal("")).optional(),
  contact_phone: z.string().trim().max(30).optional(),
  about: z.string().trim().max(5000).optional(),
});

const ORG_ROLES = ["org_admin", "hr_manager", "recruiter", "hiring_manager", "employee"] as const;

function friendly(error: unknown, fallback: string): ActionResult {
  const message = error instanceof Error ? error.message : fallback;
  if (/duplicate|unique/i.test(message)) {
    return { ok: false, error: "That slug (or another unique field) is already in use." };
  }
  return { ok: false, error: message };
}

export async function createOrganization(input: z.infer<typeof orgSchema>): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const data = orgSchema.parse(input);
    if (data.contact_phone) normalizePhone(data.contact_phone); // validates loosely; throws on garbage
    const { data: org, error } = await admin
      .from("organizations")
      .insert({
        name: data.name,
        slug: data.slug,
        industry: data.industry || null,
        website: data.website || null,
        contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null,
        about: data.about || null,
      })
      .select("id")
      .single();
    if (error || !org) throw new Error(error?.message ?? "Create failed.");
    await writeAudit({
      actorUserId: user.id,
      action: "organization.created",
      entityType: "organization",
      entityId: org.id as string,
      orgId: org.id as string,
      metadata: { name: data.name, slug: data.slug },
    });
    revalidatePath("/control-center/organizations");
    return { ok: true };
  } catch (e) {
    return friendly(e, "Failed to create organization.");
  }
}

export async function updateOrganization(
  id: string,
  input: z.infer<typeof orgSchema>,
): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const data = orgSchema.parse(input);
    const { error } = await admin
      .from("organizations")
      .update({
        name: data.name,
        slug: data.slug,
        industry: data.industry || null,
        website: data.website || null,
        contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null,
        about: data.about || null,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: user.id,
      action: "organization.updated",
      entityType: "organization",
      entityId: id,
      orgId: id,
      metadata: { name: data.name },
    });
    revalidatePath("/control-center/organizations");
    revalidatePath(`/control-center/organizations/${id}`);
    return { ok: true };
  } catch (e) {
    return friendly(e, "Failed to update organization.");
  }
}

const VERIFICATION = ["unverified", "pending", "verified", "rejected"] as const;
const ACCOUNT = ["active", "suspended", "closed"] as const;

export async function setOrgVerification(
  payload: Record<string, string>,
  note: string,
): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const status = z.enum(VERIFICATION).parse(payload.status);
    const id = z.string().uuid().parse(payload.id);
    const { error } = await admin
      .from("organizations")
      .update({ verification_status: status })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: user.id,
      action: `organization.verification_${status}`,
      entityType: "organization",
      entityId: id,
      orgId: id,
      metadata: { note },
    });
    revalidatePath("/control-center/organizations");
    revalidatePath(`/control-center/organizations/${id}`);
    revalidatePath("/control-center/approvals");
    return { ok: true };
  } catch (e) {
    return friendly(e, "Failed to update verification status.");
  }
}

export async function setOrgAccountStatus(
  payload: Record<string, string>,
  note: string,
): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const status = z.enum(ACCOUNT).parse(payload.status);
    const id = z.string().uuid().parse(payload.id);
    const { error } = await admin
      .from("organizations")
      .update({ account_status: status })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorUserId: user.id,
      action: `organization.account_${status}`,
      entityType: "organization",
      entityId: id,
      orgId: id,
      metadata: {
        note,
        enforcement:
          status === "suspended"
            ? "Suspended organizations must be excluded from public job listings (filter organizations.account_status = 'active')."
            : undefined,
      },
    });
    revalidatePath("/control-center/organizations");
    revalidatePath(`/control-center/organizations/${id}`);
    return { ok: true };
  } catch (e) {
    return friendly(e, "Failed to update account status.");
  }
}

const memberSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  role: z.enum(ORG_ROLES),
  title: z.string().trim().max(120).optional(),
});

export async function addOrgMember(
  orgId: string,
  input: z.infer<typeof memberSchema>,
): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const data = memberSchema.parse(input);
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id,is_active")
      .ilike("email", data.email)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) return { ok: false, error: "No account found with that email. Invite or provision the user first." };
    if (!profile.is_active) return { ok: false, error: "That account is suspended." };

    const { error: memberError } = await admin.from("organization_memberships").upsert(
      {
        org_id: orgId,
        user_id: profile.id,
        title: data.title || null,
        is_active: true,
      },
      { onConflict: "org_id,user_id" },
    );
    if (memberError) throw new Error(memberError.message);
    const { error: roleError } = await admin.from("user_roles").insert({
      user_id: profile.id,
      org_id: orgId,
      role: data.role,
    });
    if (roleError && !/duplicate|unique/i.test(roleError.message)) {
      throw new Error(roleError.message);
    }
    await writeAudit({
      actorUserId: user.id,
      action: "organization.member_added",
      entityType: "organization_membership",
      entityId: null,
      orgId,
      metadata: { email: data.email, role: data.role, user_id: profile.id },
    });
    revalidatePath(`/control-center/organizations/${orgId}`);
    return { ok: true };
  } catch (e) {
    return friendly(e, "Failed to add member.");
  }
}

export async function removeOrgMember(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const orgId = z.string().uuid().parse(payload.orgId);
    const memberUserId = z.string().uuid().parse(payload.memberUserId);
    // Deactivate membership and drop org-scoped role grants (audited).
    const { error: mErr } = await admin
      .from("organization_memberships")
      .update({ is_active: false })
      .eq("org_id", orgId)
      .eq("user_id", memberUserId);
    if (mErr) throw new Error(mErr.message);
    const { error: rErr } = await admin
      .from("user_roles")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", memberUserId);
    if (rErr) throw new Error(rErr.message);
    await writeAudit({
      actorUserId: user.id,
      action: "organization.member_removed",
      entityType: "organization_membership",
      entityId: null,
      orgId,
      metadata: { user_id: memberUserId },
    });
    revalidatePath(`/control-center/organizations/${orgId}`);
    return { ok: true };
  } catch (e) {
    return friendly(e, "Failed to remove member.");
  }
}

export async function setMemberRole(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const { user, admin } = await adminContext();
    const orgId = z.string().uuid().parse(payload.orgId);
    const memberUserId = z.string().uuid().parse(payload.memberUserId);
    const role = z.enum(ORG_ROLES).parse(payload.role);
    // Replace org-scoped grants with the single chosen role.
    const { error: delErr } = await admin
      .from("user_roles")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", memberUserId);
    if (delErr) throw new Error(delErr.message);
    const { error: insErr } = await admin
      .from("user_roles")
      .insert({ user_id: memberUserId, org_id: orgId, role });
    if (insErr) throw new Error(insErr.message);
    await writeAudit({
      actorUserId: user.id,
      action: "role.granted",
      entityType: "user_role",
      entityId: null,
      orgId,
      metadata: { user_id: memberUserId, role, via: "control-center" },
    });
    revalidatePath(`/control-center/organizations/${orgId}`);
    revalidatePath("/control-center/users");
    return { ok: true };
  } catch (e) {
    return friendly(e, "Failed to update member role.");
  }
}
