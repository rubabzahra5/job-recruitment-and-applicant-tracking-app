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
import { deleteCategory, upsertCategory } from "./actions";
import { ConfirmActionButton } from "@/app/(admin)/_components/action-buttons";

const schema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only."),
  icon: z.string().trim().max(60).optional(),
});

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

export function CategoryDialog({
  initial,
  triggerLabel,
}: {
  initial?: CategoryRow;
  triggerLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      slug: initial?.slug ?? "",
      icon: initial?.icon ?? "",
    },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setError(null);
    const result = await upsertCategory({ ...values, id: initial?.id });
    if (result.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error ?? "Save failed.");
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={initial ? "outline" : "primary"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={initial ? "Edit category" : "New category"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Name" htmlFor="cat-name" required error={errors.name?.message}>
            <Input id="cat-name" invalid={!!errors.name} {...register("name")} />
          </FormField>
          <FormField label="Slug" htmlFor="cat-slug" required error={errors.slug?.message} hint="Unique URL-safe identifier.">
            <Input id="cat-slug" invalid={!!errors.slug} {...register("slug")} />
          </FormField>
          <FormField label="Icon" htmlFor="cat-icon" error={errors.icon?.message} hint="Optional emoji or icon name.">
            <Input id="cat-icon" {...register("icon")} />
          </FormField>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Save</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function DeleteCategoryButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmActionButton
      title="Delete category"
      message={`Delete the category "${name}"? Jobs referencing it block deletion.`}
      confirmLabel="Delete"
      danger
      buttonLabel="Delete"
      payload={{ id }}
      action={deleteCategory}
    />
  );
}
