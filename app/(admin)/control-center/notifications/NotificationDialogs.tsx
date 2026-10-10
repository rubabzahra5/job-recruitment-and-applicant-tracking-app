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
import { ConfirmActionButton } from "@/app/(admin)/_components/action-buttons";
import { deleteTemplate, retryDelivery, upsertTemplate } from "./actions";

const schema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers and underscores only."),
  subject: z.string().trim().min(2, "Subject is required.").max(200),
  body: z.string().trim().min(2, "Body is required.").max(20000),
});

export interface TemplateRow {
  id: string;
  key: string;
  subject: string;
  body: string;
}

export function TemplateDialog({
  initial,
  triggerLabel,
}: {
  initial?: TemplateRow;
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
      key: initial?.key ?? "",
      subject: initial?.subject ?? "",
      body: initial?.body ?? "",
    },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setError(null);
    const result = await upsertTemplate({ ...values, id: initial?.id });
    if (result.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error ?? "Save failed.");
    }
  }

  return (
    <>
      <Button type="button" variant={initial ? "outline" : "primary"} size="sm" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={initial ? "Edit email template" : "New email template"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Key" htmlFor="tpl-key" required error={errors.key?.message} hint="Unique machine key, e.g. application_received.">
            <Input id="tpl-key" invalid={!!errors.key} {...register("key")} disabled={Boolean(initial)} />
          </FormField>
          <FormField label="Subject" htmlFor="tpl-subject" required error={errors.subject?.message}>
            <Input id="tpl-subject" invalid={!!errors.subject} {...register("subject")} />
          </FormField>
          <FormField
            label="Body"
            htmlFor="tpl-body"
            required
            error={errors.body?.message}
            hint="Supports {{placeholders}} replaced by the sender code."
          >
            <Textarea id="tpl-body" rows={8} invalid={!!errors.body} {...register("body")} />
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

export function DeleteTemplateButton({ id, templateKey }: { id: string; templateKey: string }) {
  return (
    <ConfirmActionButton
      title="Delete template"
      message={`Delete the email template "${templateKey}"?`}
      confirmLabel="Delete"
      danger
      buttonLabel="Delete"
      payload={{ id }}
      action={deleteTemplate}
    />
  );
}

/** Retry a failed delivery; surfaces honest unconfigured/provider errors. */
export function RetryDeliveryButton({ logId }: { logId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await retryDelivery({ logId });
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else {
        setError(res.error ?? "Retry failed.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button type="button" variant="outline" size="sm" onClick={run} disabled={busy || done}>
        {done ? "Retried" : busy ? "Retrying…" : "Retry"}
      </Button>
      {error && <span className="max-w-52 text-xs text-red-600">{error}</span>}
    </span>
  );
}
