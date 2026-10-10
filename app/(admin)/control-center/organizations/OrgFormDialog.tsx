"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { createOrganization, updateOrganization } from "./actions";

const schema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(200),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only."),
  industry: z.string().trim().max(120).optional(),
  website: z.string().trim().max(200).optional(),
  contact_email: z.string().trim().max(200).optional().refine(
    (v) => !v || /.+@.+\..+/.test(v),
    "Enter a valid contact email.",
  ),
  contact_phone: z.string().trim().max(30).optional(),
  about: z.string().trim().max(5000).optional(),
});

export type OrgFormValues = z.infer<typeof schema>;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function OrgFormDialog({
  mode,
  orgId,
  initial,
  triggerLabel,
}: {
  mode: "create" | "edit";
  orgId?: string;
  initial?: Partial<OrgFormValues>;
  triggerLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OrgFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      slug: initial?.slug ?? "",
      industry: initial?.industry ?? "",
      website: initial?.website ?? "",
      contact_email: initial?.contact_email ?? "",
      contact_phone: initial?.contact_phone ?? "",
      about: initial?.about ?? "",
    },
  });
  const name = watch("name");

  React.useEffect(() => {
    if (mode === "create" && name) {
      setValue("slug", slugify(name), { shouldValidate: false });
    }
  }, [name, mode, setValue]);

  async function onSubmit(values: OrgFormValues) {
    setError(null);
    const result =
      mode === "create"
        ? await createOrganization(values)
        : await updateOrganization(orgId ?? "", values);
    if (result.ok) {
      setOpen(false);
      reset();
      router.refresh();
    } else {
      setError(result.error ?? "Save failed.");
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={mode === "create" ? "primary" : "outline"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? "Create organization" : "Edit organization"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Name" htmlFor="org-name" required error={errors.name?.message}>
            <Input id="org-name" invalid={!!errors.name} {...register("name")} />
          </FormField>
          <FormField label="Slug" htmlFor="org-slug" required error={errors.slug?.message} hint="URL-safe unique identifier.">
            <Input id="org-slug" invalid={!!errors.slug} {...register("slug")} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Industry" htmlFor="org-industry" error={errors.industry?.message}>
              <Input id="org-industry" {...register("industry")} />
            </FormField>
            <FormField label="Website" htmlFor="org-website" error={errors.website?.message}>
              <Input id="org-website" placeholder="https://" {...register("website")} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Contact email" htmlFor="org-email" error={errors.contact_email?.message}>
              <Input id="org-email" type="email" {...register("contact_email")} />
            </FormField>
            <FormField label="Contact phone" htmlFor="org-phone" error={errors.contact_phone?.message}>
              <Input id="org-phone" placeholder="03XXXXXXXXX" {...register("contact_phone")} />
            </FormField>
          </div>
          <FormField label="About" htmlFor="org-about" error={errors.about?.message}>
            <Textarea id="org-about" rows={3} {...register("about")} />
          </FormField>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {mode === "create" ? "Create" : "Save changes"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
