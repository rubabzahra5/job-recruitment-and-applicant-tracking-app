"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Alert } from "@/components/ui/Alert";
import type { ActionResult } from "../_lib/org";
import type { OrgProfileData, OrgProfileInput } from "../employer/profile/actions";

const formSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(150),
  about: z.string(),
  industry: z.string(),
  website: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string(),
  sizeRange: z.string(),
  locationsText: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

const SIZE_RANGES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];

/** Organization profile editor (org_admin only, enforced server-side too). */
export function OrgProfileForm({
  initial,
  saveAction,
}: {
  initial: OrgProfileData;
  saveAction: (input: OrgProfileInput) => Promise<ActionResult>;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initial.name,
      about: initial.about ?? "",
      industry: initial.industry ?? "",
      website: initial.website ?? "",
      contactEmail: initial.contactEmail ?? "",
      contactPhone: initial.contactPhone ?? "",
      sizeRange: initial.sizeRange ?? "",
      locationsText: initial.locations.join(", "),
    },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setSaved(false);
    setSaving(true);
    try {
      const email = values.contactEmail.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setServerError("Contact email is not valid.");
        return;
      }
      const website = values.website.trim();
      if (website && !/^https?:\/\//i.test(website)) {
        setServerError("Website must be a valid http(s) URL.");
        return;
      }
      const result = await saveAction({
        name: values.name.trim(),
        about: values.about.trim() || null,
        industry: values.industry.trim() || null,
        website: website || null,
        contactEmail: email || null,
        contactPhone: values.contactPhone.trim() || null,
        sizeRange: values.sizeRange || null,
        locations: values.locationsText.split(",").map((l) => l.trim()).filter(Boolean).slice(0, 20),
      });
      if (result.ok) {
        setSaved(true);
        window.location.reload();
      } else {
        setServerError(result.error);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2" noValidate>
      {serverError && (
        <div className="md:col-span-2">
          <Alert tone="error" title="Could not save">{serverError}</Alert>
        </div>
      )}
      {saved && (
        <div className="md:col-span-2">
          <Alert tone="success" title="Saved">Organization profile updated.</Alert>
        </div>
      )}
      <FormField label="Organization name" htmlFor="org-name" required error={errors.name?.message}>
        <Input {...register("name")} invalid={!!errors.name} />
      </FormField>
      <FormField label="Industry" htmlFor="org-industry">
        <Input {...register("industry")} placeholder="e.g. Information Technology" />
      </FormField>
      <FormField label="About" htmlFor="org-about" className="md:col-span-2">
        <Textarea {...register("about")} rows={4} />
      </FormField>
      <FormField label="Website" htmlFor="org-website">
        <Input {...register("website")} placeholder="https://…" inputMode="url" />
      </FormField>
      <FormField label="Company size" htmlFor="org-size">
        <Select {...register("sizeRange")}>
          <option value="">Select…</option>
          {SIZE_RANGES.map((s) => (
            <option key={s} value={s}>{s} employees</option>
          ))}
        </Select>
      </FormField>
      <FormField label="Contact email" htmlFor="org-email">
        <Input type="email" {...register("contactEmail")} />
      </FormField>
      <FormField label="Contact phone" htmlFor="org-phone">
        <Input {...register("contactPhone")} placeholder="e.g. +92 21 34567890" />
      </FormField>
      <FormField label="Office locations" htmlFor="org-locations" hint="Comma separated, e.g. Karachi, Lahore" className="md:col-span-2">
        <Input {...register("locationsText")} placeholder="Karachi, Lahore" />
      </FormField>
      <div className="md:col-span-2">
        <Button type="submit" isLoading={saving}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

/** Logo upload (PNG/JPEG, 5 MB) — posts FormData to the server action. */
export function OrgLogoUpload({ uploadAction }: { uploadAction: (formData: FormData) => Promise<ActionResult> }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const upload = async () => {
    if (!file) return;
    setWorking(true);
    setError(null);
    const fd = new FormData();
    fd.append("logo", file);
    const res = await uploadAction(fd);
    setWorking(false);
    if (!res.ok) setError(res.error);
    else window.location.reload();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          aria-label="Organization logo"
          className="max-w-xs"
        />
        <Button variant="outline" disabled={!file} isLoading={working} onClick={upload}>
          Upload logo
        </Button>
      </div>
      <p className="mt-1 text-xs text-slate-500">PNG or JPEG, max 5 MB. Stored in the org-logos bucket.</p>
      {error && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
