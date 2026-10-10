"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { changeApplicationStage } from "./actions";

/**
 * Stage-change dialog for the cross-org application browser.
 * Offers only the stages reachable from the current stage (server also
 * validates via lib/pipeline.ts + the DB trigger).
 */
export function StageChangeDialog({
  applicationId,
  fromStage,
  allowedStages,
}: {
  applicationId: string;
  fromStage: string;
  allowedStages: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [toStage, setToStage] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!toStage) {
      setError("Select a target stage.");
      return;
    }
    if (note.trim().length < 3) {
      setError("A short note is required (min 3 characters).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await changeApplicationStage({ applicationId, toStage }, note.trim());
      if (res.ok) {
        setOpen(false);
        setToStage("");
        setNote("");
        router.refresh();
      } else {
        setError(res.error ?? "Stage change failed.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stage change failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={allowedStages.length === 0}
        title={allowedStages.length === 0 ? "No outgoing transitions (terminal stage)" : "Change stage"}
        onClick={() => { setError(null); setOpen(true); }}
      >
        Move stage
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Change application stage">
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-slate-600">
            Current stage: <strong>{fromStage}</strong>
          </p>
          <FormField label="New stage" htmlFor={`stage-${applicationId}`} required>
            <Select
              id={`stage-${applicationId}`}
              value={toStage}
              onChange={(e) => setToStage(e.target.value)}
            >
              <option value="">Select…</option>
              {allowedStages.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Note" htmlFor={`note-${applicationId}`} required>
            <Textarea
              id={`note-${applicationId}`}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason for the stage change…"
            />
          </FormField>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" isLoading={busy}>
              Change stage
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
