"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Card, CardContent } from "@/components/ui/Card";
import { formatDateKarachi, formatSalaryRange } from "@/lib/format";
import { unsaveJob, type SavedJobRow } from "../_actions";

export function SavedJobCard({ saved }: { saved: SavedJobRow }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const job = saved.job;

  async function confirmRemove() {
    if (!job) return;
    setBusy(true);
    setError(null);
    const result = await unsaveJob(job.id);
    setBusy(false);
    if (result.ok) {
      setConfirmOpen(false);
    } else {
      setError(result.error ?? "Failed to remove.");
      setConfirmOpen(false);
    }
  }

  if (!job) {
    // Practically unreachable: saved_jobs.job_id is ON DELETE CASCADE, so a
    // deleted job removes its saved rows automatically.
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-slate-500">This job is no longer available.</p>
        </CardContent>
      </Card>
    );
  }

  const closed = job.status !== "published" || (job.deadline != null && new Date(job.deadline).getTime() <= Date.now());

  return (
    <Card>
      <CardContent>
        {error && <Alert tone="error" className="mb-3">{error}</Alert>}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/jobs/${job.slug}`}
              className="text-base font-semibold text-slate-900 hover:text-brand-700 hover:underline"
            >
              {job.title}
            </Link>
            <p className="mt-0.5 text-sm text-slate-600">
              {job.org?.name ?? ""}
              {job.location ? ` · ${job.location.city}, ${job.location.province}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={closed ? "neutral" : "success"}>
                {closed ? "Closed" : "Open"}
              </Badge>
              <span className="text-xs text-slate-500">
                {job.employment_type.replace(/_/g, " ")}
              </span>
              {job.salary_disclosed && (
                <span className="text-xs text-slate-500">
                  {formatSalaryRange(job.salary_min, job.salary_max, job.salary_period)}
                </span>
              )}
              <span className="text-xs text-slate-400">
                Saved {formatDateKarachi(saved.created_at, { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {!closed && (
              <Link href={`/candidate/apply/${job.slug}`}>
                <Button variant="primary" size="sm">Apply</Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
              Remove
            </Button>
          </div>
        </div>
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => void confirmRemove()}
          title="Remove saved job?"
          message={`“${job.title}” will be removed from your saved jobs.`}
          confirmLabel="Remove"
          danger
          isConfirming={busy}
        />
      </CardContent>
    </Card>
  );
}
