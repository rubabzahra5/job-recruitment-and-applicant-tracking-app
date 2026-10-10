"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import type { ActionResult } from "../_lib/org";
import { JOB_ACTION_LABELS } from "../employer/jobs/job-schema";

interface JobActionsProps {
  jobId: string;
  orgId: string;
  currentStatus: string;
  allowedTargets: string[];
  transitionAction: (jobId: string, to: string, orgId: string, note?: string) => Promise<ActionResult>;
  deleteAction?: (jobId: string, orgId: string) => Promise<ActionResult>;
  compact?: boolean;
}

/** Status-transition buttons with confirmation; a note dialog for rejections. */
export function JobActions({
  jobId,
  orgId,
  currentStatus,
  allowedTargets,
  transitionAction,
  deleteAction,
  compact = false,
}: JobActionsProps) {
  const [pending, setPending] = React.useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = React.useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [showDelete, setShowDelete] = React.useState(false);

  const run = async (to: string, noteValue?: string) => {
    setPending(to);
    setError(null);
    try {
      const result = await transitionAction(jobId, to, orgId, noteValue);
      if (!result.ok) {
        setError(result.error);
      } else {
        setConfirmTarget(null);
        setRejectOpen(false);
        setNote("");
        window.location.reload();
      }
    } finally {
      setPending(null);
    }
  };

  const runDelete = async () => {
    if (!deleteAction) return;
    setPending("__delete");
    const result = await deleteAction(jobId, orgId);
    setPending(null);
    if (!result.ok) setError(result.error);
    else window.location.href = `/employer/jobs?org=${encodeURIComponent(orgId)}`;
  };

  const size = compact ? "sm" : "md";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {allowedTargets.map((to) =>
        to === "rejected" ? (
          <Button key={to} type="button" size={size} variant="danger" onClick={() => setRejectOpen(true)}>
            {JOB_ACTION_LABELS[to]}
          </Button>
        ) : (
          <Button
            key={to}
            type="button"
            size={size}
            variant={to === "archived" ? "danger" : to === "published" || to === "approved" ? "primary" : "outline"}
            onClick={() => setConfirmTarget(to)}
          >
            {JOB_ACTION_LABELS[to] ?? to}
          </Button>
        ),
      )}
      {deleteAction && ["draft", "rejected", "archived"].includes(currentStatus) && (
        <Button type="button" size={size} variant="danger" onClick={() => setShowDelete(true)}>
          Delete
        </Button>
      )}
      {error && <p className="w-full text-sm text-red-600" role="alert">{error}</p>}

      <ConfirmDialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => { if (confirmTarget) void run(confirmTarget); }}
        title={`${JOB_ACTION_LABELS[confirmTarget ?? ""] ?? confirmTarget} job`}
        message={
          confirmTarget === "published"
            ? "Publishing makes this vacancy visible on the public job board."
            : `Move this job from "${currentStatus}" to "${JOB_ACTION_LABELS[confirmTarget ?? ""] ?? confirmTarget}"?`
        }
        confirmLabel={JOB_ACTION_LABELS[confirmTarget ?? ""] ?? "Confirm"}
        danger={confirmTarget === "archived"}
        isConfirming={pending !== null}
      />

      <Dialog
        open={rejectOpen}
        onClose={() => {
          setRejectOpen(false);
          setNote("");
        }}
        title="Reject job"
        description="The job returns to the author with your note recorded in the approval history. A note is required."
      >
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Budget not approved yet"
          aria-label="Rejection note"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setRejectOpen(false); setNote(""); }}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => run("rejected", note.trim())} disabled={!note.trim()} isLoading={pending === "rejected"}>
            Reject job
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={runDelete}
        title="Delete job"
        message="Permanently delete this job posting? This cannot be undone."
        confirmLabel="Delete"
        danger
        isConfirming={pending === "__delete"}
      />
    </div>
  );
}
