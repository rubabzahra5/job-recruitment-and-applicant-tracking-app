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
import { Select } from "@/components/ui/Select";
import { ConfirmActionButton } from "@/app/(admin)/_components/action-buttons";
import { PROVINCES } from "./provinces";
import { deleteLocation, upsertLocation } from "./actions";

const schema = z.object({
  city: z.string().trim().min(2, "City is required.").max(120),
  province: z.enum(PROVINCES),
  country: z.string().trim().min(2).max(120),
});

export interface LocationRow {
  id: string;
  city: string;
  province: string;
  country: string;
}

export function LocationDialog({
  initial,
  triggerLabel,
}: {
  initial?: LocationRow;
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
      city: initial?.city ?? "",
      province: (initial?.province as (typeof PROVINCES)[number]) ?? "Punjab",
      country: initial?.country ?? "Pakistan",
    },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setError(null);
    const result = await upsertLocation({ ...values, id: initial?.id });
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
        title={initial ? "Edit location" : "New location"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="City" htmlFor="loc-city" required error={errors.city?.message}>
            <Input id="loc-city" invalid={!!errors.city} {...register("city")} placeholder="Lahore" />
          </FormField>
          <FormField label="Province / territory" htmlFor="loc-province" required error={errors.province?.message}>
            <Select id="loc-province" {...register("province")}>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Country" htmlFor="loc-country" required error={errors.country?.message}>
            <Input id="loc-country" {...register("country")} />
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

export function DeleteLocationButton({ id, label }: { id: string; label: string }) {
  return (
    <ConfirmActionButton
      title="Delete location"
      message={`Delete "${label}"? Jobs referencing it block deletion.`}
      confirmLabel="Delete"
      danger
      buttonLabel="Delete"
      payload={{ id }}
      action={deleteLocation}
    />
  );
}
