"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { processPrivacyRequest, revealCandidatePII, type RevealedCandidate } from "./actions";

/** Reveal PII for one candidate (the reveal is audit-logged server-side). */
export function RevealCandidateButton({ candidateUserId }: { candidateUserId: string }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [candidate, setCandidate] = React.useState<RevealedCandidate | null>(null);

  async function reveal() {
    setBusy(true);
    setError(null);
    try {
      const res = await revealCandidatePII({ candidateUserId });
      if (res.ok && res.candidate) setCandidate(res.candidate);
      else setError(res.error ?? "Reveal failed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reveal failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => { setError(null); setCandidate(null); setOpen(true); }}>
        Reveal PII
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Candidate details (PII)">
        {candidate ? (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Full name</dt><dd className="font-medium">{candidate.fullName}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Email</dt><dd>{candidate.email}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Phone</dt><dd>{candidate.phone || "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">City</dt><dd>{candidate.city || "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Province</dt><dd>{candidate.province || "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Headline</dt><dd>{candidate.headline || "—"}</dd></div>
          </dl>
        ) : (
          <>
            <Alert tone="warning">
              Revealing this candidate&apos;s personal data will be written to the audit log
              (action candidate_pii_revealed) with your account as the actor.
            </Alert>
            {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button type="button" onClick={reveal} isLoading={busy}>Reveal (logged)</Button>
            </div>
          </>
        )}
        {candidate && (
          <div className="mt-6 flex justify-end">
            <Button type="button" onClick={() => setOpen(false)}>Close</Button>
          </div>
        )}
      </Dialog>
    </>
  );
}

/** Process a privacy request with a decision + note. */
export function PrivacyRequestDialog({
  requestId,
  type,
  email,
}: {
  requestId: string;
  type: string;
  email: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [decision, setDecision] = React.useState("in_progress");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (note.trim().length < 3) {
      setError("A note is required (min 3 characters).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await processPrivacyRequest({ requestId, decision }, note.trim());
      if (res.ok) {
        setOpen(false);
        setNote("");
        router.refresh();
      } else {
        setError(res.error ?? "Processing failed.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => { setError(null); setOpen(true); }}>
        Process
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Privacy request — ${type}`}>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-slate-600">
            Requester: <strong>{email}</strong>
            {type === "deletion" && (
              <span className="mt-1 block text-xs text-slate-500">
                Completing a deletion request removes the candidate profile and dependent rows
                (education, experience, skills, certifications, documents). Applications are
                retained as hiring-org business records.
              </span>
            )}
          </p>
          <FormField label="Decision" htmlFor={`decision-${requestId}`} required>
            <Select id={`decision-${requestId}`} value={decision} onChange={(e) => setDecision(e.target.value)}>
              <option value="in_progress">Mark in progress</option>
              <option value="completed">Mark completed</option>
              <option value="rejected">Reject</option>
            </Select>
          </FormField>
          <FormField label="Processing note" htmlFor={`note-${requestId}`} required>
            <Textarea
              id={`note-${requestId}`}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was done, or why rejected…"
            />
          </FormField>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" isLoading={busy}>Save decision</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
