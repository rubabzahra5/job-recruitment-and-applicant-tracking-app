"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import type { ActionResult } from "../_lib/org";
import type { FeedbackInput } from "../employer/interviews/actions";

interface InterviewActionsProps {
  interviewId: string;
  status: string;
  rescheduleAction: (interviewId: string, scheduledAtLocal: string, durationMinutes: number) => Promise<ActionResult>;
  cancelAction: (interviewId: string, reason: string) => Promise<ActionResult>;
  attendanceAction: (interviewId: string, status: "completed" | "no_show") => Promise<ActionResult>;
}

/** Per-interview actions: reschedule, cancel, mark attendance. */
export function InterviewActions({ interviewId, status, rescheduleAction, cancelAction, attendanceAction }: InterviewActionsProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [working, setWorking] = React.useState(false);
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [attendanceTarget, setAttendanceTarget] = React.useState<"completed" | "no_show" | null>(null);
  const [newDateTime, setNewDateTime] = React.useState("");
  const [newDuration, setNewDuration] = React.useState("30");
  const [cancelReason, setCancelReason] = React.useState("");

  const run = async (fn: () => Promise<ActionResult>, close: () => void) => {
    setWorking(true);
    setError(null);
    const res = await fn();
    setWorking(false);
    if (!res.ok) setError(res.error);
    else {
      close();
      window.location.reload();
    }
  };

  const active = ["scheduled", "rescheduled"].includes(status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {active && (
        <>
          <Button size="sm" variant="outline" onClick={() => setRescheduleOpen(true)}>
            Reschedule
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAttendanceTarget("completed")}>
            Mark completed
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAttendanceTarget("no_show")}>
            No-show
          </Button>
          <Button size="sm" variant="danger" onClick={() => setCancelOpen(true)}>
            Cancel
          </Button>
        </>
      )}
      {error && (
        <p className="w-full text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      <Dialog open={rescheduleOpen} onClose={() => setRescheduleOpen(false)} title="Reschedule interview" description="Pick a new date and time (Asia/Karachi). Conflicts are checked before saving.">
        <div className="grid gap-3">
          <Input type="datetime-local" value={newDateTime} onChange={(e) => setNewDateTime(e.target.value)} aria-label="New date and time" />
          <Input type="number" min={5} max={480} value={newDuration} onChange={(e) => setNewDuration(e.target.value)} aria-label="Duration in minutes" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRescheduleOpen(false)}>
            Close
          </Button>
          <Button
            disabled={!newDateTime}
            isLoading={working}
            onClick={() => run(() => rescheduleAction(interviewId, newDateTime, Number(newDuration) || 30), () => setRescheduleOpen(false))}
          >
            Reschedule
          </Button>
        </div>
      </Dialog>

      <Dialog open={cancelOpen} onClose={() => { setCancelOpen(false); setCancelReason(""); }} title="Cancel interview" description="The candidate and interviewers will be notified. A reason is required.">
        <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} placeholder="Reason for cancellation…" aria-label="Cancellation reason" />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setCancelOpen(false); setCancelReason(""); }}>
            Close
          </Button>
          <Button variant="danger" disabled={!cancelReason.trim()} isLoading={working} onClick={() => run(() => cancelAction(interviewId, cancelReason.trim()), () => { setCancelOpen(false); setCancelReason(""); })}>
            Cancel interview
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={attendanceTarget !== null}
        onClose={() => setAttendanceTarget(null)}
        onConfirm={() => { if (attendanceTarget) void run(() => attendanceAction(interviewId, attendanceTarget), () => setAttendanceTarget(null)); }}
        title={attendanceTarget === "completed" ? "Mark interview completed" : "Mark as no-show"}
        message={
          attendanceTarget === "completed"
            ? "Mark this interview as completed? The application will advance to Interview Completed when the pipeline allows it."
            : "Mark this interview as a no-show?"
        }
        confirmLabel="Confirm"
        isConfirming={working}
      />
    </div>
  );
}

interface FeedbackFormProps {
  interviewId: string;
  existing: { rating: number; strengths: string | null; concerns: string | null; recommendation: string } | null;
  submitAction: (interviewId: string, input: FeedbackInput) => Promise<ActionResult>;
}

/** Structured interview feedback: rating 1–5 + recommendation. */
export function FeedbackForm({ interviewId, existing, submitAction }: FeedbackFormProps) {
  const [rating, setRating] = React.useState(existing?.rating ?? 0);
  const [strengths, setStrengths] = React.useState(existing?.strengths ?? "");
  const [concerns, setConcerns] = React.useState(existing?.concerns ?? "");
  const [recommendation, setRecommendation] = React.useState(existing?.recommendation ?? "maybe");
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const submit = async () => {
    if (rating < 1 || rating > 5) {
      setError("Select a rating from 1 to 5.");
      return;
    }
    setWorking(true);
    setError(null);
    const res = await submitAction(interviewId, {
      rating,
      strengths: strengths.trim() || undefined,
      concerns: concerns.trim() || undefined,
      recommendation: recommendation as FeedbackInput["recommendation"],
    });
    setWorking(false);
    if (!res.ok) setError(res.error);
    else {
      setSaved(true);
      window.location.reload();
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <h3 className="text-sm font-semibold">{existing ? "Update your feedback" : "Submit feedback"}</h3>
      <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={rating === v}
            onClick={() => setRating(v)}
            className={`h-9 w-9 rounded-md border text-sm font-bold ${
              rating === v ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {v}
          </button>
        ))}
        <span className="ml-2 text-xs text-slate-500">1 = poor … 5 = excellent</span>
      </div>
      <div className="mt-3 grid gap-2">
        <Textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={2} placeholder="Strengths…" aria-label="Strengths" />
        <Textarea value={concerns} onChange={(e) => setConcerns(e.target.value)} rows={2} placeholder="Concerns…" aria-label="Concerns" />
        <Select value={recommendation} onChange={(e) => setRecommendation(e.target.value)} aria-label="Recommendation">
          <option value="hire">Hire</option>
          <option value="maybe">Maybe</option>
          <option value="no_hire">No hire</option>
        </Select>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={rating < 1} isLoading={working}>
          {existing ? "Update feedback" : "Submit feedback"}
        </Button>
        {saved && <span className="text-xs text-emerald-700">Saved.</span>}
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
