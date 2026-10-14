import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

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

export const metadata: Metadata = { title: "Create Organization" };
export const dynamic = "force-dynamic";

export default async function NewOrganizationPage() {
  try {
    await adminPageGuard("/control-center/organizations/new");
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }

  async function handleCreate(formData: FormData) {
    "use server";
    const { admin, user } = await (
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

    if (name.length < 2) throw new Error("Name is required (min 2 characters).");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error("Slug must be lowercase letters, numbers and hyphens only.");
    }

    const { data: org, error } = await admin
      .from("organizations")
      .insert({
        name,
        slug,
        industry: industry || null,
        website: website || null,
        contact_email: contact_email || null,
        contact_phone: contact_phone || null,
        about: about || null,
      })
      .select("id")
      .single();

    if (error || !org) throw new Error(error?.message ?? "Create failed.");

    await writeAudit({
      actorUserId: user.id,
      action: "organization.created",
      entityType: "organization",
      entityId: (org as any).id,
      orgId: (org as any).id,
      metadata: { name, slug },
    });

    redirect("/control-center/organizations");
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/control-center/organizations"
          className="text-sm text-brand-700 hover:underline"
        >
          ← Back to organizations
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Create organization</h1>
        <p className="mt-1 text-sm text-slate-600">
          Add a new company to the platform.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form action={handleCreate} className="space-y-4">
            <FormField label="Company name" htmlFor="org-name" required>
              <Input id="org-name" name="name" required minLength={2} maxLength={200} />
            </FormField>
            <FormField label="Slug" htmlFor="org-slug" required hint="Lowercase letters, numbers and hyphens only.">
              <Input id="org-slug" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Industry" htmlFor="org-industry">
                <Input id="org-industry" name="industry" maxLength={120} />
              </FormField>
              <FormField label="Website" htmlFor="org-website">
                <Input id="org-website" name="website" maxLength={200} placeholder="https://" />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Contact email" htmlFor="org-email">
                <Input id="org-email" name="contact_email" type="email" maxLength={200} />
              </FormField>
              <FormField label="Contact phone" htmlFor="org-phone">
                <Input id="org-phone" name="contact_phone" maxLength={30} placeholder="03XXXXXXXXX" />
              </FormField>
            </div>
            <FormField label="About" htmlFor="org-about">
              <Textarea id="org-about" name="about" rows={4} maxLength={5000} />
            </FormField>
            <div className="flex justify-end gap-2">
              <Link href="/control-center/organizations">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
              <Button type="submit">Create organization</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
