"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/Dialog";
import type { ActionResult } from "../_lib/org";

interface StageMoveControlProps {
  orgId: string;
  applicationId: string;
  currentStage: string;
  allowedTargets: { key: string; label: string }[];
  moveAction: (orgId: string, applicationId: string, toStage: string, reason?: string) => Promise<ActionResult>;
}

/** Per-card stage move with optional reason; server-validates the transition. */
export function StageMoveControl({
  orgId,
  applicationId,
  currentStage,
  allowedTargets,
  moveAction,
}: StageMoveControlProps) {
  const [target, setTarget] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [moving, setMoving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const targets = allowedTargets.filter((t) => t.key !== currentStage);
  if (targets.length === 0) return null;

  const run = async () => {
    if (!target) return;
    setMoving(true);
    setError(null);
    try {
      const result = await moveAction(orgId, applicationId, target, reason.trim() || undefined);
      if (!result.ok) {
        setError(result.error);
      } else {
        setConfirmOpen(false);
        setTarget("");
        setReason("");
        window.location.reload();
      }
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        <Select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          aria-label="Move to stage"
          className="h-8 min-w-0 flex-1 text-xs"
        >
          <option value="">Move to…</option>
          {targets.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </Select>
        <Button size="sm" variant="outline" disabled={!target} onClick={() => setConfirmOpen(true)}>
          Move
        </Button>
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setReason("");
        }}
        onConfirm={run}
        title="Change stage"
        message={`Move this application to "${allowedTargets.find((t) => t.key === target)?.label ?? target}"? The candidate will be notified.`}
        confirmLabel="Move"
        isConfirming={moving}
      />
    </div>
  );
}
