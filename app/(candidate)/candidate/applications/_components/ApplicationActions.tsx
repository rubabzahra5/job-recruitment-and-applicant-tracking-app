"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { FormField } from "@/components/ui/FormField";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { withdrawApplication, postApplicationMessage } from "../_actions";

const messageSchema = z.object({
  message: z.string().trim().min(1, "Write a message first.").max(2000),
});

type MessageInput = z.infer<typeof messageSchema>;

/** Withdraw button with confirmation dialog (destructive action). */
export function WithdrawButton({
  applicationId,
  canWithdraw,
}: {
  applicationId: string;
  canWithdraw: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const result = await withdrawApplication(applicationId);
    setBusy(false);
    if (result.ok) {
      setOpen(false);
    } else {
      setError(result.error ?? "Failed to withdraw.");
      setOpen(false);
    }
  }

  if (!canWithdraw) return null;

  return (
    <div>
      {error && <Alert tone="error" className="mb-3">{error}</Alert>}
      <Button variant="outline" onClick={() => setOpen(true)}>
        Withdraw application
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => void confirm()}
        title="Withdraw this application?"
        message="The employer will be notified and your application will move to Withdrawn. You can apply again later if the job is still open."
        confirmLabel="Withdraw"
        danger
        isConfirming={busy}
      />
    </div>
  );
}

/** Candidate↔employer message thread composer. */
export function MessageComposer({ applicationId }: { applicationId: string }) {
  const [topError, setTopError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MessageInput>({
    resolver: zodResolver(messageSchema),
    defaultValues: { message: "" },
  });

  async function onSubmit(data: MessageInput) {
    setTopError(null);
    const result = await postApplicationMessage(applicationId, data);
    if (result.ok) {
      reset();
    } else {
      setTopError(result.error ?? "Failed to send message.");
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="mt-4">
      {topError && <Alert tone="error" className="mb-3">{topError}</Alert>}
      <FormField label="Send a message" htmlFor="new-message" error={errors.message?.message}>
        <Textarea
          id="new-message"
          {...register("message")}
          invalid={!!errors.message}
          rows={3}
          placeholder="Ask about timelines, interview logistics…"
        />
      </FormField>
      <div className="mt-2 flex justify-end">
        <Button type="submit" size="sm" isLoading={isSubmitting}>
          Send message
        </Button>
      </div>
    </form>
  );
}
