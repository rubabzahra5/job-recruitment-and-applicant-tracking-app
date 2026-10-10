"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Alert } from "@/components/ui/Alert";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { formatDateOnlyKarachi } from "@/lib/format";
import type { ActionResult } from "../_lib/org";
import type { BulkMoveResult } from "../employer/applications/actions";

export interface ApplicationRow {
  id: string;
  stage: string;
  stageLabel: string;
  submittedAt: string;
  jobTitle: string;
  candidateName: string;
  candidateHeadline: string | null;
  assignees: string[];
}

interface ApplicationsTableProps {
  orgId: string;
  rows: ApplicationRow[];
  stages: { key: string; label: string }[];
  transitions: { from_key: string; to_key: string }[];
  bulkAction: (orgId: string, input: { applicationIds: string[]; toStage: string; reason?: string }) => Promise<BulkMoveResult>;
}

type SortKey = "submittedAt" | "candidateName" | "jobTitle" | "stageLabel";

/** Searchable/sortable table with bounded bulk stage updates. */
export function ApplicationsTable({ orgId, rows, stages, transitions, bulkAction }: ApplicationsTableProps) {
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("submittedAt");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = React.useState("");
  const [bulkReason, setBulkReason] = React.useState("");
  const [confirmBulk, setConfirmBulk] = React.useState(false);
  const [working, setWorking] = React.useState(false);
  const [result, setResult] = React.useState<BulkMoveResult | null>(null);

  const stageLabelOf = React.useCallback(
    (key: string) => stages.find((s) => s.key === key)?.label ?? key,
    [stages],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? rows.filter(
          (r) =>
            r.candidateName.toLowerCase().includes(q) ||
            r.jobTitle.toLowerCase().includes(q) ||
            r.stageLabel.toLowerCase().includes(q),
        )
      : rows;
    const sorted = [...base].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, query, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((r) => r.id)),
    );
  };

  // Bulk target must be valid from EVERY selected row's stage (conservative).
  const commonTargets = React.useMemo(() => {
    if (selected.size === 0) return [];
    const selRows = rows.filter((r) => selected.has(r.id));
    const perRow = selRows.map((r) =>
      new Set(transitions.filter((t) => t.from_key === r.stage).map((t) => t.to_key)),
    );
    const first = perRow[0];
    if (!first) return [];
    return [...first].filter((k) => perRow.every((s) => s.has(k))).map((k) => ({ key: k, label: stageLabelOf(k) }));
  }, [selected, rows, transitions, stageLabelOf]);

  const runBulk = async () => {
    setWorking(true);
    setResult(null);
    try {
      const res = await bulkAction(orgId, {
        applicationIds: [...selected],
        toStage: bulkTarget,
        reason: bulkReason.trim() || undefined,
      });
      setResult(res);
      if (res.ok) {
        setSelected(new Set());
        setBulkTarget("");
        setBulkReason("");
        setConfirmBulk(false);
        window.location.reload();
      }
    } finally {
      setWorking(false);
    }
  };

  const sortIndicator = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search candidate, job, stage…"
          aria-label="Search applications"
          className="w-64"
        />
        <span className="text-sm text-slate-500">
          {filtered.length} of {rows.length}
        </span>
      </div>

      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 p-3">
          <span className="text-sm font-medium">{selected.size} selected (max 50)</span>
          <Select
            value={bulkTarget}
            onChange={(e) => setBulkTarget(e.target.value)}
            aria-label="Bulk target stage"
            className="w-52"
          >
            <option value="">Bulk move to…</option>
            {commonTargets.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </Select>
          <Input
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
            placeholder="Reason (optional)"
            aria-label="Bulk move reason"
            className="w-52"
          />
          <Button
            variant="primary"
            disabled={!bulkTarget || selected.size > 50}
            onClick={() => setConfirmBulk(true)}
          >
            Apply
          </Button>
          <Button variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
          {commonTargets.length === 0 && (
            <span className="text-xs text-slate-500">No single stage is valid from all selected rows — narrow the selection.</span>
          )}
        </div>
      )}

      {result && !result.ok && (
        <div className="mt-3">
          <Alert tone="error" title="Bulk update failed">
            {(result as ActionResult & { ok: false }).error}
          </Alert>
        </div>
      )}

      <div className="mt-3">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleAll}
                  aria-label="Select all rows"
                  className="h-4 w-4"
                />
              </TableHeaderCell>
              <TableHeaderCell>
                <button type="button" onClick={() => toggleSort("candidateName")} className="font-semibold uppercase">
                  Candidate{sortIndicator("candidateName")}
                </button>
              </TableHeaderCell>
              <TableHeaderCell>
                <button type="button" onClick={() => toggleSort("jobTitle")} className="font-semibold uppercase">
                  Vacancy{sortIndicator("jobTitle")}
                </button>
              </TableHeaderCell>
              <TableHeaderCell>
                <button type="button" onClick={() => toggleSort("stageLabel")} className="font-semibold uppercase">
                  Stage{sortIndicator("stageLabel")}
                </button>
              </TableHeaderCell>
              <TableHeaderCell>
                <button type="button" onClick={() => toggleSort("submittedAt")} className="font-semibold uppercase">
                  Submitted{sortIndicator("submittedAt")}
                </button>
              </TableHeaderCell>
              <TableHeaderCell>Assignees</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggleSelect(r.id)}
                    aria-label={`Select application of ${r.candidateName}`}
                    className="h-4 w-4"
                  />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/employer/applications/${r.id}?org=${encodeURIComponent(orgId)}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {r.candidateName}
                  </Link>
                  {r.candidateHeadline && <p className="text-xs text-slate-500">{r.candidateHeadline}</p>}
                </TableCell>
                <TableCell>{r.jobTitle}</TableCell>
                <TableCell>{r.stageLabel}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDateOnlyKarachi(r.submittedAt)}</TableCell>
                <TableCell className="text-xs text-slate-500">{r.assignees.join(", ") || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && <p className="mt-4 text-sm text-slate-500">No applications match.</p>}
      </div>

      <ConfirmDialog
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        onConfirm={runBulk}
        title="Bulk stage update"
        message={`Move ${selected.size} application(s) to "${stageLabelOf(bulkTarget)}"? Each move is validated against the pipeline and written to the status history. Candidates are notified.`}
        confirmLabel={`Move ${selected.size}`}
        isConfirming={working}
      />
    </div>
  );
}
