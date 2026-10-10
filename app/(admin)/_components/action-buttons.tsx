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
import { Textarea } from "@/components/ui/Textarea";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";

interface ConfirmActionButtonProps {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  buttonLabel: React.ReactNode;
  buttonVariant?: Variant;
  payload?: Record<string, string>;
  action: (payload: Record<string, string>) => Promise<ActionResult>;
}

/**
 * Button that opens a ConfirmDialog and then runs a server action.
 * Used for destructive/privileged control-center actions.
 */
export function ConfirmActionButton({
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  buttonLabel,
  buttonVariant = "outline",
  payload = {},
  action,
}: ConfirmActionButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await action(payload);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error ?? "Action failed.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={buttonVariant}
        size="sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {buttonLabel}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title}>
        <p className="text-sm text-slate-600">{message}</p>
        {error && (
          <div className="mt-3">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={danger ? "danger" : "primary"}
            onClick={confirm}
            isLoading={busy}
          >
            {confirmLabel}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

const noteSchema = z.object({
  note: z.string().trim().min(3, "A note is required (min 3 characters).").max(2000),
});

interface NoteActionButtonProps {
  title: string;
  description?: string;
  noteLabel?: string;
  notePlaceholder?: string;
  confirmLabel?: string;
  danger?: boolean;
  buttonLabel: React.ReactNode;
  buttonVariant?: Variant;
  payload?: Record<string, string>;
  action: (payload: Record<string, string>, note: string) => Promise<ActionResult>;
}

/**
 * Button that opens a dialog with a required moderation note (validated with
 * zod + React Hook Form) and then runs a server action. Moderation decisions
 * are stored alongside their notes in job_approvals / offer_approvals etc.
 */
export function NoteActionButton({
  title,
  description,
  noteLabel = "Moderation note",
  notePlaceholder = "Reason for this decision…",
  confirmLabel = "Confirm",
  danger = false,
  buttonLabel,
  buttonVariant = "outline",
  payload = {},
  action,
}: NoteActionButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<{ note: string }>({ resolver: zodResolver(noteSchema) });

  async function onSubmit(data: { note: string }) {
    setError(null);
    try {
      const res = await action(payload, data.note);
      if (res.ok) {
        reset();
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error ?? "Action failed.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={buttonVariant}
        size="sm"
        onClick={() => {
          setError(null);
          reset();
          setOpen(true);
        }}
      >
        {buttonLabel}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
      >
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          aria-label={title}
        >
          <FormField label={noteLabel} htmlFor="note" required error={errors.note?.message}>
            <Textarea
              id="note"
              rows={4}
              placeholder={notePlaceholder}
              invalid={!!errors.note}
              {...register("note")}
            />
          </FormField>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={danger ? "danger" : "primary"} isLoading={isSubmitting}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
