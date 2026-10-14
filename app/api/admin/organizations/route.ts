import { NextResponse } from "next/server";
import { z } from "zod";
import { adminContext } from "@/app/(admin)/_components/admin-server";
import { writeAudit } from "@/lib/audit";

const orgSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  industry: z.string().trim().max(120).optional(),
  website: z.string().trim().max(200).optional(),
  contact_email: z.string().trim().email().max(200).or(z.literal("")).optional(),
  contact_phone: z.string().trim().max(30).optional(),
  about: z.string().trim().max(5000).optional(),
});

/**
 * Create an organization (called by OrgFormDialog).
 * Alternative to server actions to avoid SSR import issues.
 */
export async function POST(request: Request) {
  try {
    const { user, admin } = await adminContext();
    const body = await request.json();
    const data = orgSchema.parse(body);

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

    return NextResponse.json({ ok: true, id: org.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
