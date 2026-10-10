"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/Dialog";
import type { ActionResult } from "../_lib/org";

interface DepartmentManagerProps {
  departments: { id: string; name: string; jobCount: number; memberCount: number }[];
  createAction: (name: string) => Promise<ActionResult>;
  renameAction: (departmentId: string, name: string) => Promise<ActionResult>;
  deleteAction: (departmentId: string) => Promise<ActionResult>;
}

/** Department CRUD with delete protection messaging. */
export function DepartmentManager({ departments, createAction, renameAction, deleteAction }: DepartmentManagerProps) {
  const [newName, setNewName] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const run = async (fn: () => Promise<ActionResult>, after: () => void) => {
    setWorking(true);
    setError(null);
    const res = await fn();
    setWorking(false);
    if (!res.ok) setError(res.error);
    else {
      after();
      window.location.reload();
    }
  };

  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim()) void run(() => createAction(newName.trim()), () => setNewName(""));
        }}
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New department name…"
          aria-label="New department name"
          className="max-w-sm"
        />
        <Button type="submit" disabled={!newName.trim()} isLoading={working}>
          Add
        </Button>
      </form>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {departments.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3">
            {editingId === d.id ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editName.trim()) void run(() => renameAction(d.id, editName.trim()), () => setEditingId(null));
                }}
              >
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} aria-label="Department name" className="max-w-sm" />
                <Button type="submit" size="sm" disabled={!editName.trim()} isLoading={working}>
                  Save
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </form>
            ) : (
              <>
                <div>
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-slate-500">
                    {d.jobCount} job{d.jobCount === 1 ? "" : "s"} · {d.memberCount} member{d.memberCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditingId(d.id); setEditName(d.name); }}>
                    Rename
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleteId(d.id)}>
                    Delete
                  </Button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {departments.length === 0 && <p className="mt-4 text-sm text-slate-500">No departments yet.</p>}

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) void run(() => deleteAction(deleteId), () => setDeleteId(null)); }}
        title="Delete department"
        message="Delete this department? This is blocked while jobs or members reference it."
        confirmLabel="Delete"
        danger
        isConfirming={working}
      />
    </div>
  );
}
