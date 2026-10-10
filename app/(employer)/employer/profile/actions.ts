"use server";

import { z } from "zod";
import { requireSessionUser } from "@/lib/auth";
import { requireOrgRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { MAX_LOGO_BYTES } from "@/lib/uploads";
import {
  getOrgSettings,
  okResult,
  failResult,
  revalidateEmployer,
  type ActionResult,
} from "../../_lib/org";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(150),
  about: z.string().trim().max(5000).nullable(),
  industry: z.string().trim().max(100).nullable(),
  website: z.string().trim().max(300).nullable().refine(
    (v) => !v || /^https?:\/\//i.test(v),
    { message: "Website must be a valid http(s) URL." },
  ),
  contactEmail: z.string().trim().email("Enter a valid email address.").nullable().or(z.literal("")),
  contactPhone: z.string().trim().max(30).nullable(),
  sizeRange: z.string().trim().max(50).nullable(),
  locations: z.array(z.string().trim().min(1).max(100)).max(20),
});

export type OrgProfileInput = z.infer<typeof profileSchema>;

export interface OrgProfileData {
  name: string;
  logoUrl: string | null;
  about: string | null;
  industry: string | null;
  website: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  sizeRange: string | null;
  verificationStatus: string;
  locations: string[];
}

/** Load the org profile for the page (org-scoped). */
export async function getOrgProfile(orgId: string): Promise<OrgProfileData> {
  const user = await requireSessionUser();
  await requireOrgRole(user.id, orgId, { atLeast: "employee" });
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("name,logo_url,about,industry,website,contact_email,contact_phone,size_range,verification_status")
    .eq("id", orgId)
    .single();
  if (!org) throw new Error("Organization not found.");
  const settings = await getOrgSettings(orgId);
  return {
    name: org.name as string,
    logoUrl: (org.logo_url as string | null) ?? null,
    about: (org.about as string | null) ?? null,
    industry: (org.industry as string | null) ?? null,
    website: (org.website as string | null) ?? null,
    contactEmail: (org.contact_email as string | null) ?? null,
    contactPhone: (org.contact_phone as string | null) ?? null,
    sizeRange: (org.size_range as string | null) ?? null,
    verificationStatus: org.verification_status as string,
    locations: settings.locations,
  };
}

/**
 * Update the org profile (org_admin only). Locations are stored in
 * organization_settings (the organizations table has no location column).
 */
export async function updateOrgProfile(orgId: string, input: OrgProfileInput): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, ["org_admin"]);
    const parsed = profileSchema.parse(input);
    const admin = createAdminClient();

    const { error } = await admin
      .from("organizations")
      .update({
        name: parsed.name,
        about: parsed.about || null,
        industry: parsed.industry || null,
        website: parsed.website || null,
        contact_email: parsed.contactEmail || null,
        contact_phone: parsed.contactPhone || null,
        size_range: parsed.sizeRange || null,
      })
      .eq("id", orgId);
    if (error) throw new Error(`Failed to update profile: ${error.message}`);

    // Locations live in organization_settings (upsert).
    const { data: existing } = await admin
      .from("organization_settings")
      .select("id,settings")
      .eq("org_id", orgId)
      .maybeSingle();
    const merged = { ...((existing?.settings as Record<string, unknown>) ?? {}), locations: parsed.locations };
    if (existing) {
      const { error: sErr } = await admin.from("organization_settings").update({ settings: merged }).eq("id", existing.id);
      if (sErr) throw new Error(`Failed to save locations: ${sErr.message}`);
    } else {
      const { error: sErr } = await admin.from("organization_settings").insert({ org_id: orgId, settings: merged });
      if (sErr) throw new Error(`Failed to save locations: ${sErr.message}`);
    }

    await writeAudit({ actorUserId: user.id, action: "organization.profile_updated", entityType: "organization", entityId: orgId, orgId });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

function sniffImageMime(bytes: Uint8Array): "image/png" | "image/jpeg" | null {
  if (bytes.length >= 4 && PNG_MAGIC.every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes.length >= 3 && JPEG_MAGIC.every((b, i) => bytes[i] === b)) return "image/jpeg";
  return null;
}

/**
 * Upload the org logo to the org-logos bucket (org_admin only).
 * Validates size (5 MB), magic bytes (PNG/JPEG), and stores under
 * org-logos/{org_id}/{uuid}.{ext}; the public URL is saved on the org.
 */
export async function uploadOrgLogo(orgId: string, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    await requireOrgRole(user.id, orgId, ["org_admin"]);
    const file = formData.get("logo");
    if (!(file instanceof File) || file.size === 0) throw new Error("Select a logo file.");
    if (file.size > MAX_LOGO_BYTES) throw new Error("Logo exceeds the 5 MB limit.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffImageMime(bytes);
    if (!mime) throw new Error("Logo must be a PNG or JPEG image.");
    const ext = mime === "image/png" ? "png" : "jpg";

    const admin = createAdminClient();
    const path = `${orgId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from("org-logos")
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data } = admin.storage.from("org-logos").getPublicUrl(path);
    const { error: updateError } = await admin
      .from("organizations")
      .update({ logo_url: data.publicUrl })
      .eq("id", orgId);
    if (updateError) throw new Error(`Failed to save logo: ${updateError.message}`);

    await writeAudit({ actorUserId: user.id, action: "organization.logo_uploaded", entityType: "organization", entityId: orgId, orgId });
    revalidateEmployer();
    return okResult();
  } catch (e) {
    return failResult(e);
  }
}
