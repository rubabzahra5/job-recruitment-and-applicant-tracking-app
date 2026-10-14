import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  AdminDeniedError,
  adminPageGuard,
} from "@/app/(admin)/_components/admin-server";
import { AdminDenied } from "@/app/(admin)/_components/AdminDenied";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Edit Organization" };
export const dynamic = "force-dynamic";

export default async function EditOrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    await adminPageGuard(`/control-center/organizations/${id}/edit`);
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id,name,slug,industry,website,contact_email,contact_phone,about")
    .eq("id", id)
    .single();

  if (!org) notFound();

  async function handleUpdate(formData: FormData) {
    "use server";
    const { admin: adminClient, user } = await (
      await import("@/app/(admin)/_components/admin-server")
    ).adminContext();
    const { writeAudit } = await import("@/lib/audit");

    const name = ((formData.get("name") as string) ?? "").trim();
    const slug = ((formData.get("slug") as string) ?? "").trim().toLowerCase();
    const industry = ((formData.get("industry") as string) ?? "").trim();
    const website = ((formData.get("website") as string) ?? "").trim();
    const contact_email = ((formData.get("contact_email") as string) ?? "").trim();
    const contact_phone = ((formData.get("contact_phone") as string) ?? "").trim();
    const about = ((formData.get("about") as string) ?? "").trim();

    if (name.length < 2) throw new Error("Name is required.");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error("Invalid slug format.");
    }

    const { error } = await adminClient
      .from("organizations")
      .update({
        name,
        slug,
        industry: industry || null,
        website: website || null,
        contact_email: contact_email || null,
        contact_phone: contact_phone || null,
        about: about || null,
      })
      .eq("id", id);

    if (error) throw new Error(error.message);

    await writeAudit({
      actorUserId: user.id,
      action: "organization.updated",
      entityType: "organization",
      entityId: id,
      orgId: id,
      metadata: { name },
    });

    redirect(`/control-center/organizations/${id}`);
  }

  const o = org as any;

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/control-center/organizations/${id}`}
          className="text-sm text-brand-700 hover:underline"
        >
          ← Back to organization
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Edit organization</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form action={handleUpdate} className="space-y-4">
            <FormField label="Company name" htmlFor="org-name" required>
              <Input id="org-name" name="name" required defaultValue={o.name} maxLength={200} />
            </FormField>
            <FormField label="Slug" htmlFor="org-slug" required>
              <Input
                id="org-slug"
                name="slug"
                required
                defaultValue={o.slug}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                maxLength={80}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Industry" htmlFor="org-industry">
                <Input id="org-industry" name="industry" defaultValue={o.industry ?? ""} maxLength={120} />
              </FormField>
              <FormField label="Website" htmlFor="org-website">
                <Input id="org-website" name="website" defaultValue={o.website ?? ""} maxLength={200} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Contact email" htmlFor="org-email">
                <Input id="org-email" name="contact_email" type="email" defaultValue={o.contact_email ?? ""} maxLength={200} />
              </FormField>
              <FormField label="Contact phone" htmlFor="org-phone">
                <Input id="org-phone" name="contact_phone" defaultValue={o.contact_phone ?? ""} maxLength={30} />
              </FormField>
            </div>
            <FormField label="About" htmlFor="org-about">
              <Textarea id="org-about" name="about" rows={4} defaultValue={o.about ?? ""} maxLength={5000} />
            </FormField>
            <div className="flex justify-end gap-2">
              <Link href={`/control-center/organizations/${id}`}>
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
              <Button type="submit">Save changes</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
