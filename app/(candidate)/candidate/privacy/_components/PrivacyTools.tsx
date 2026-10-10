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
import { formatDateKarachi } from "@/lib/format";
import { exportCandidateData, requestDeletion, requestCorrection } from "../_actions";

/** Download a JSON export built from live database queries. */
export function ExportButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const data = await exportCandidateData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `job-recruitment-and-applicant-tracking-system-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <Alert tone="error" className="mb-3">{error}</Alert>}
      <p className="text-sm text-slate-600">
        Download everything we store about you — profile, applications,
        messages, saved jobs, alerts, notifications and consent history — as
        JSON. CV file contents aren&apos;t included here; download those from the
        Resume page.
      </p>
      <div className="mt-3">
        <Button onClick={() => void handleExport()} isLoading={busy}>
          Download my data (JSON)
        </Button>
      </div>
    </div>
  );
}

const deletionSchema = z.object({
  detail: z.string().trim().max(2000).optional().or(z.literal("")),
});

export function DeletionForm() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filed, setFiled] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<z.infer<typeof deletionSchema>>({
    resolver: zodResolver(deletionSchema),
    defaultValues: { detail: "" },
  });

  async function confirm() {
    setBusy(true);
    setTopError(null);
    const result = await requestDeletion({ detail: getValues("detail") });
    setBusy(false);
    setConfirmOpen(false);
    if (result.ok) setFiled(true);
    else setTopError(result.error ?? "Failed to file request.");
  }

  if (filed) {
    return (
      <Alert tone="success" title="Deletion request filed">
        Your request is recorded as <strong>pending</strong> and will be
        reviewed by the platform team. We&apos;ll notify you here once it&apos;s
        resolved.
      </Alert>
    );
  }

  return (
    <div>
      {topError && <Alert tone="error" className="mb-3">{topError}</Alert>}
      <Alert tone="warning" className="mb-4" title="How deletion works">
        Filing a request does <strong>not</strong> delete your data instantly.
        The platform team reviews each request: your profile, CVs and inactive
        data are removed, but information tied to applications already shared
        with employers (e.g. hiring records, submitted application copies) may
        be retained as required for lawful hiring records. We&apos;ll tell you
        exactly what was removed and what was kept, and why.
      </Alert>
      <form onSubmit={(e) => void handleSubmit(() => setConfirmOpen(true))(e)} noValidate>
        <FormField
          label="Anything we should know? (optional)"
          htmlFor="deletion-detail"
          error={errors.detail?.message}
        >
          <Textarea
            id="deletion-detail"
            {...register("detail")}
            invalid={!!errors.detail}
            rows={3}
            placeholder="Optional context for the review team…"
          />
        </FormField>
        <div className="mt-3">
          <Button type="submit" variant="danger">
            Request account deletion
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void confirm()}
        title="Request account deletion?"
        message="This files a deletion request for review. Your account stays active until the review is complete."
        confirmLabel="File request"
        danger
        isConfirming={busy}
      />
    </div>
  );
}

const correctionSchema = z.object({
  detail: z
    .string()
    .trim()
    .min(10, "Describe what needs correcting (at least 10 characters).")
    .max(2000),
});

export function CorrectionForm() {
  const [filed, setFiled] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof correctionSchema>>({
    resolver: zodResolver(correctionSchema),
    defaultValues: { detail: "" },
  });

  async function onSubmit(data: z.infer<typeof correctionSchema>) {
    setTopError(null);
    const result = await requestCorrection(data);
    if (result.ok) {
      setFiled(true);
      reset();
      setTimeout(() => setFiled(false), 6000);
    } else {
      setTopError(result.error ?? "Failed to file request.");
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
      {topError && <Alert tone="error" className="mb-3">{topError}</Alert>}
      {filed && (
        <Alert tone="success" className="mb-3">
          Correction request filed. The platform team will review it and notify
          you here.
        </Alert>
      )}
      <p className="mb-3 text-sm text-slate-600">
        Spotted something wrong in your data that you can&apos;t fix yourself on
        the Profile page? Tell us here.
      </p>
      <FormField
        label="What needs correcting?"
        htmlFor="correction-detail"
        required
        error={errors.detail?.message}
      >
        <Textarea
          id="correction-detail"
          {...register("detail")}
          invalid={!!errors.detail}
          rows={4}
          placeholder="e.g. My submitted application shows the wrong degree title…"
        />
      </FormField>
      <div className="mt-3">
        <Button type="submit" isLoading={isSubmitting}>
          File correction request
        </Button>
      </div>
    </form>
  );
}

export function PrivacyNotice() {
  return (
    <div className="prose-sm text-sm text-slate-700">
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Private by default.</strong> Your profile is hidden from
          employers unless you apply to their job or switch on “Let employers
          find my profile” in your preferences.
        </li>
        <li>
          <strong>What we store.</strong> Your profile details, CVs, job
          applications (including the CV copy you submitted), messages with
          hiring teams, saved jobs, job alerts, notifications and consent
          records.
        </li>
        <li>
          <strong>Who sees what.</strong> Employers you apply to see your
          profile and the CV you attached to that application. Other
          candidates never see your data. Internal recruiter notes are never
          shown to candidates.
        </li>
        <li>
          <strong>No sensitive fields required.</strong> We never require CNIC,
          date of birth, marital status, photo or religion for ordinary
          applications.
        </li>
        <li>
          <strong>Your rights.</strong> Export your data anytime (JSON),
          correct inaccuracies, or request deletion — all from this page.
        </li>
        <li>
          <strong>Retention.</strong> Application copies shared with employers
          may be retained as lawful hiring records even after a deletion
          request; we&apos;ll always tell you what was kept and why.
        </li>
      </ul>
      <p className="mt-3 text-xs text-slate-500">
        Request history below shows the status of your past requests
        (pending → in progress → completed/rejected).
      </p>
    </div>
  );
}

export function RequestHistory({
  requests,
}: {
  requests: Array<{
    id: string;
    type: string;
    status: string;
    detail: string | null;
    created_at: string;
    resolved_at: string | null;
  }>;
}) {
  if (requests.length === 0) return null;
  return (
    <ul className="mt-4 divide-y divide-slate-100">
      {requests.map((r) => (
        <li key={r.id} className="py-3 text-sm">
          <p className="font-medium capitalize text-slate-900">
            {r.type} request · <span className="text-slate-500">{r.status.replace(/_/g, " ")}</span>
          </p>
          {r.detail && <p className="mt-0.5 text-slate-600">{r.detail}</p>}
          <p className="mt-0.5 text-xs text-slate-400">
            Filed {formatDateKarachi(r.created_at, { day: "numeric", month: "short", year: "numeric" })}
            {r.resolved_at
              ? ` · Resolved ${formatDateKarachi(r.resolved_at, { day: "numeric", month: "short", year: "numeric" })}`
              : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
