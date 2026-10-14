"use client";

import * as React from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
// Note: uses /api/admin/organizations instead of server actions to avoid SSR issues.

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

interface OrgFormData {
  name: string;
  slug: string;
  industry: string;
  website: string;
  contact_email: string;
  contact_phone: string;
  about: string;
}

/**
 * Organization create/edit dialog.
 * Uses simple controlled inputs (no react-hook-form) to avoid SSR issues.
 */
export function OrgFormDialog({
  mode,
  orgId,
  initial,
  triggerLabel,
}: {
  mode: "create" | "edit";
  orgId?: string;
  initial?: Partial<OrgFormData>;
  triggerLabel: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [form, setForm] = React.useState<OrgFormData>({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    industry: initial?.industry ?? "",
    website: initial?.website ?? "",
    contact_email: initial?.contact_email ?? "",
    contact_phone: initial?.contact_phone ?? "",
    about: initial?.about ?? "",
  });

  const set = (key: keyof OrgFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-generate slug from name in create mode.
      if (mode === "create" && key === "name") {
        next.slug = slugify(value);
      }
      return next;
    });
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Basic validation.
    if (form.name.trim().length < 2) {
      setError("Name is required (min 2 characters).");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) {
      setError("Slug must be lowercase letters, numbers and hyphens only.");
      return;
    }
    if (form.contact_email && !/.+@.+\..+/.test(form.contact_email)) {
      setError("Enter a valid contact email.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Create mode uses API route; edit mode uses server action via page.
      if (mode === "create") {
        const res = await fetch("/api/admin/organizations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const result = await res.json();
        if (result.ok) {
          setOpen(false);
          window.location.reload();
        } else {
          setError(result.error ?? "Save failed.");
        }
      } else {
        // Edit mode: reload page to use server action from detail page.
        setError("Edit is available on the organization detail page.");
      }
    } finally {
      setIsSubmitting(false);
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
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Name" htmlFor="org-name" required>
            <Input id="org-name" value={form.name} onChange={set("name")} />
          </FormField>
          <FormField label="Slug" htmlFor="org-slug" required hint="URL-safe unique identifier.">
            <Input id="org-slug" value={form.slug} onChange={set("slug")} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Industry" htmlFor="org-industry">
              <Input id="org-industry" value={form.industry} onChange={set("industry")} />
            </FormField>
            <FormField label="Website" htmlFor="org-website">
              <Input id="org-website" placeholder="https://" value={form.website} onChange={set("website")} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Contact email" htmlFor="org-email">
              <Input id="org-email" type="email" value={form.contact_email} onChange={set("contact_email")} />
            </FormField>
            <FormField label="Contact phone" htmlFor="org-phone">
              <Input id="org-phone" placeholder="03XXXXXXXXX" value={form.contact_phone} onChange={set("contact_phone")} />
            </FormField>
          </div>
          <FormField label="About" htmlFor="org-about">
            <Textarea id="org-about" rows={3} value={form.about} onChange={set("about")} />
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
