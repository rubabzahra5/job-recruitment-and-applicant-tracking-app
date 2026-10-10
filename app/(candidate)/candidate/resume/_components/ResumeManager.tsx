"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent } from "@/components/ui/Card";
import { formatDateKarachi } from "@/lib/format";
import { uploadCv, setCurrentCv, deleteCv, type CvDocument } from "../_actions";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * CV upload + management. Upload runs as a server action (validated with
 * lib/uploads.ts); while it runs, an animated progress bar shows that work
 * is in progress. Validation errors are surfaced from the action result.
 */
export function ResumeManager({ documents }: { documents: CvDocument[] }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [deleting, setDeleting] = useState<CvDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  function startProgress() {
    setProgress(4);
    timerRef.current = setInterval(() => {
      setProgress((p) => Math.min(92, p + Math.max(1, (92 - p) * 0.12)));
    }, 180);
  }

  function stopProgress(done: boolean) {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setProgress(done ? 100 : 0);
    if (done) {
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 450);
    } else {
      setUploading(false);
    }
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a PDF or DOCX file first.");
      return;
    }
    setError(null);
    setSuccess(null);
    setUploading(true);
    startProgress();
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadCv(formData);
    stopProgress(result.ok);
    if (result.ok) {
      setSuccess("CV uploaded successfully.");
      if (fileRef.current) fileRef.current.value = "";
    } else {
      setError(result.error ?? "Upload failed.");
    }
  }

  async function handleSetCurrent(id: string) {
    setError(null);
    setBusy(true);
    const result = await setCurrentCv(id);
    setBusy(false);
    if (result.ok) setSuccess("Current CV updated.");
    else setError(result.error ?? "Failed to update.");
  }

  async function handleDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    const result = await deleteCv(deleting.id);
    setBusy(false);
    if (result.ok) {
      setDeleting(null);
      setSuccess("CV deleted.");
    } else {
      setError(result.error ?? "Failed to delete.");
      setDeleting(null);
    }
  }

  return (
    <div>
      {error && (
        <Alert tone="error" className="mb-4" title="Something went wrong">
          {error}
        </Alert>
      )}
      {success && (
        <Alert tone="success" className="mb-4">
          {success}
        </Alert>
      )}

      <Card className="mb-6">
        <CardContent>
          <h2 className="text-base font-semibold">Upload a CV</h2>
          <p className="mt-1 text-sm text-slate-600">
            PDF or DOCX only, up to 10&nbsp;MB. Your file is checked before
            it&apos;s stored.
          </p>
          <form onSubmit={(e) => void handleUpload(e)} className="mt-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                aria-label="Choose CV file (PDF or DOCX)"
                disabled={uploading}
                className="text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-50 disabled:opacity-60"
              />
              <Button type="submit" isLoading={uploading} disabled={uploading}>
                Upload CV
              </Button>
            </div>
            {uploading && (
              <div className="mt-4" role="status" aria-live="polite">
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-[width] duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Uploading and validating… {Math.round(progress)}%
                </p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <h2 className="mb-3 text-base font-semibold">Your CVs</h2>
      {documents.length === 0 ? (
        <EmptyState
          title="No CV uploaded"
          description="Upload your CV to attach it to job applications."
        />
      ) : (
        <ul className="space-y-3">
          {documents.map((doc) => (
            <li key={doc.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                      <span className="truncate">{doc.file_name}</span>
                      {doc.is_current_cv && <Badge tone="success">Current CV</Badge>}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {doc.mime_type === "application/pdf" ? "PDF" : "DOCX"} ·{" "}
                      {formatBytes(doc.size_bytes)} · uploaded{" "}
                      {formatDateKarachi(doc.created_at, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <a
                      href={`/candidate/resume/download/${doc.id}`}
                      className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    >
                      Download
                    </a>
                    {!doc.is_current_cv && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleSetCurrent(doc.id)}
                      >
                        Set as current
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => setDeleting(doc)}
                      aria-label={`Delete ${doc.file_name}`}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
        title="Delete this CV?"
        message={
          deleting?.is_current_cv
            ? `“${deleting?.file_name}” is your current CV and will be deleted. Your most recent remaining CV becomes the current one.`
            : `“${deleting?.file_name}” will be deleted.`
        }
        confirmLabel="Delete"
        danger
        isConfirming={busy}
      />
    </div>
  );
}
