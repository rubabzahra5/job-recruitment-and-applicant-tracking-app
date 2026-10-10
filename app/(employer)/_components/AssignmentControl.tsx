"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/Dialog";
import type { ActionResult } from "../_lib/org";

export interface AssigneeOption {
  userId: string;
  name: string;
}

export interface AssignmentRow {
  id: string;
  userId: string;
  name: string;
}

interface AssignmentControlProps {
  options: AssigneeOption[];
  assignments: AssignmentRow[];
  assignAction: (assigneeUserId: string) => Promise<ActionResult>;
  unassignAction: (assignmentId: string) => Promise<ActionResult>;
}

/** Assign applications to colleagues; assignments drive hiring-manager scoping + notifications. */
export function AssignmentControl({ options, assignments, assignAction, unassignAction }: AssignmentControlProps) {
  const [selected, setSelected] = React.useState("");
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [removeId, setRemoveId] = React.useState<string | null>(null);

  const assign = async () => {
    if (!selected) return;
    setWorking(true);
    setError(null);
    const res = await assignAction(selected);
    setWorking(false);
    if (!res.ok) setError(res.error);
    else {
      setSelected("");
      window.location.reload();
    }
  };

  const unassign = async () => {
    if (!removeId) return;
    setWorking(true);
    const res = await unassignAction(removeId);
    setWorking(false);
    setRemoveId(null);
    if (!res.ok) setError(res.error);
    else window.location.reload();
  };

  const available = options.filter((o) => !assignments.some((a) => a.userId === o.userId));

  return (
    <div>
      {assignments.length === 0 ? (
        <p className="text-sm text-slate-500">No one assigned yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {assignments.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-1.5 text-sm">
              <span>{a.name}</span>
              <Button variant="ghost" size="sm" onClick={() => setRemoveId(a.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        <Select value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Assign to colleague" className="flex-1">
          <option value="">Assign to…</option>
          {available.map((o) => (
            <option key={o.userId} value={o.userId}>
              {o.name}
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={assign} disabled={!selected} isLoading={working}>
          Assign
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={removeId !== null}
        onClose={() => setRemoveId(null)}
        onConfirm={unassign}
        title="Remove assignment"
        message="Remove this colleague from the application?"
        confirmLabel="Remove"
        isConfirming={working}
      />
    </div>
  );
}
