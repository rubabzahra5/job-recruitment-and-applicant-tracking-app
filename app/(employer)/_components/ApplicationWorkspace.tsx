"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Alert } from "@/components/ui/Alert";
import { formatDateKarachi } from "@/lib/format";
import type { ActionResult } from "../_lib/org";
import { RUBRIC_CRITERIA } from "../_lib/rubric";

// ─── notes ────────────────────────────────────────────────────────────────

export interface NoteRow {
  id: string;
  note: string;
  authorName: string;
  isOwn: boolean;
  canModerate: boolean;
  createdAt: string;
}

export interface ParsedRubric {
  noteId: string;
  authorName: string;
  createdAt: string;
  scores: Record<string, number>;
  comments: Record<string, string>;
  summary: string;
}

function NotesSection({
  notes,
  addAction,
  updateAction,
  deleteAction,
}: {
  notes: NoteRow[];
  addAction: (note: string) => Promise<ActionResult>;
  updateAction: (noteId: string, note: string) => Promise<ActionResult>;
  deleteAction: (noteId: string) => Promise<ActionResult>;
}) {
  const [draft, setDraft] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState("");
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
      {notes.length === 0 ? (
        <p className="text-sm text-slate-500">No internal notes yet. Notes are visible only to your hiring team — never to the candidate.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium text-slate-700">{n.authorName}</span>
                <span>{formatDateKarachi(n.createdAt)}</span>
              </div>
              {editingId === n.id ? (
                <div className="mt-2">
                  <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} aria-label="Edit note" />
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" disabled={!editText.trim()} isLoading={working} onClick={() => run(() => updateAction(n.id, editText.trim()), () => setEditingId(null))}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{n.note}</p>
                  {(n.isOwn || n.canModerate) && (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(n.id); setEditText(n.note); }}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteId(n.id)}>
                        Delete
                      </Button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Add an internal note… (never shown to the candidate)"
          aria-label="New internal note"
        />
        <Button
          className="mt-2"
          size="sm"
          disabled={!draft.trim()}
          isLoading={working}
          onClick={() => run(() => addAction(draft.trim()), () => setDraft(""))}
        >
          Add note
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) void run(() => deleteAction(deleteId), () => setDeleteId(null)); }}
        title="Delete note"
        message="Permanently delete this internal note?"
        confirmLabel="Delete"
        danger
        isConfirming={working}
      />
    </div>
  );
}

// ─── rubric ───────────────────────────────────────────────────────────────

function RubricSection({
  rubrics,
  existing,
  saveAction,
}: {
  rubrics: ParsedRubric[];
  existing: ParsedRubric | null;
  saveAction: (rubric: { scores: Record<string, number>; comments: Record<string, string>; summary: string }) => Promise<ActionResult>;
}) {
  const [scores, setScores] = React.useState<Record<string, number>>(() => existing?.scores ?? {});
  const [comments, setComments] = React.useState<Record<string, string>>(() => existing?.comments ?? {});
  const [summary, setSummary] = React.useState(existing?.summary ?? "");
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const complete = RUBRIC_CRITERIA.every((c) => scores[c.key] !== undefined);

  const save = async () => {
    setWorking(true);
    setError(null);
    setSaved(false);
    const res = await saveAction({ scores, comments, summary: summary.trim() });
    setWorking(false);
    if (!res.ok) setError(res.error);
    else {
      setSaved(true);
      window.location.reload();
    }
  };

  return (
    <div>
      {rubrics.length > 0 && (
        <ul className="mb-4 space-y-3">
          {rubrics.map((r) => (
            <li key={r.noteId} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium text-slate-700">{r.authorName} — structured rating</span>
                <span>{formatDateKarachi(r.createdAt)}</span>
              </div>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
                {RUBRIC_CRITERIA.map((c) => (
                  <div key={c.key} className="flex justify-between gap-2 border-b border-slate-100 py-1">
                    <dt className="text-slate-600">{c.label}</dt>
                    <dd className="font-semibold tabular-nums">{r.scores[c.key] ?? "—"}/5</dd>
                  </div>
                ))}
              </dl>
              {r.summary && <p className="mt-2 text-sm italic text-slate-600">“{r.summary}”</p>}
              {Object.entries(r.comments).some(([, v]) => v) && (
                <details className="mt-1 text-sm">
                  <summary className="cursor-pointer text-brand-700">Criterion comments</summary>
                  <ul className="mt-1 space-y-1 text-slate-600">
                    {Object.entries(r.comments).map(([k, v]) =>
                      v ? (
                        <li key={k}>
                          <span className="font-medium">{RUBRIC_CRITERIA.find((c) => c.key === k)?.label ?? k}:</span> {v}
                        </li>
                      ) : null,
                    )}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3 className="text-sm font-semibold">{existing ? "Update your rating" : "Add your rating"}</h3>
      <div className="mt-2 space-y-3">
        {RUBRIC_CRITERIA.map((c) => (
          <div key={c.key} className="grid gap-1 md:grid-cols-[180px_1fr]">
            <span className="text-sm font-medium text-slate-700">
              {c.label} <span className="text-red-600">*</span>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <div role="radiogroup" aria-label={c.label} className="flex gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={scores[c.key] === v}
                    onClick={() => setScores((s) => ({ ...s, [c.key]: v }))}
                    className={`h-8 w-8 rounded-md border text-sm font-medium ${
                      scores[c.key] === v
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <Input
                value={comments[c.key] ?? ""}
                onChange={(e) => setComments((m) => ({ ...m, [c.key]: e.target.value }))}
                placeholder="Comment (optional)"
                aria-label={`${c.label} comment`}
                className="min-w-0 flex-1"
              />
            </div>
          </div>
        ))}
        <Textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          placeholder="Overall summary (optional)"
          aria-label="Rating summary"
        />
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={!complete} isLoading={working} onClick={save}>
            {existing ? "Update rating" : "Save rating"}
          </Button>
          {!complete && <span className="text-xs text-slate-500">Rate all five criteria to save.</span>}
          {saved && <span className="text-xs text-emerald-700">Saved.</span>}
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── messages ─────────────────────────────────────────────────────────────

export interface MessageRow {
  id: string;
  message: string;
  isFromCandidate: boolean;
  senderName: string;
  createdAt: string;
}

function MessagesSection({
  messages,
  sendAction,
}: {
  messages: MessageRow[];
  sendAction: (message: string) => Promise<ActionResult>;
}) {
  const [draft, setDraft] = React.useState("");
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const send = async () => {
    if (!draft.trim()) return;
    setWorking(true);
    setError(null);
    const res = await sendAction(draft.trim());
    setWorking(false);
    if (!res.ok) setError(res.error);
    else {
      setDraft("");
      window.location.reload();
    }
  };

  return (
    <div>
      {messages.length === 0 ? (
        <p className="text-sm text-slate-500">No messages yet. Messages here are visible to the candidate.</p>
      ) : (
        <ul className="space-y-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`max-w-[85%] rounded-lg p-3 text-sm ${
                m.isFromCandidate ? "bg-slate-100" : "ml-auto bg-brand-50 ring-1 ring-brand-100"
              }`}
            >
              <div className="flex items-center justify-between gap-4 text-xs text-slate-500">
                <span className="font-medium">{m.isFromCandidate ? `Candidate · ${m.senderName}` : `Your team · ${m.senderName}`}</span>
                <span>{formatDateKarachi(m.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{m.message}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Write a message to the candidate…"
          aria-label="Message to candidate"
        />
        <Button className="mt-2" size="sm" disabled={!draft.trim()} isLoading={working} onClick={send}>
          Send message
        </Button>
        <p className="mt-1 text-xs text-slate-500">The candidate gets an in-app notification.</p>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── workspace ────────────────────────────────────────────────────────────

export function ApplicationWorkspace({
  notes,
  rubrics,
  existingRubric,
  messages,
  noteActions,
  rubricAction,
  messageAction,
}: {
  notes: NoteRow[];
  rubrics: ParsedRubric[];
  existingRubric: ParsedRubric | null;
  messages: MessageRow[];
  noteActions: {
    add: (note: string) => Promise<ActionResult>;
    update: (noteId: string, note: string) => Promise<ActionResult>;
    remove: (noteId: string) => Promise<ActionResult>;
  };
  rubricAction: (rubric: { scores: Record<string, number>; comments: Record<string, string>; summary: string }) => Promise<ActionResult>;
  messageAction: (message: string) => Promise<ActionResult>;
}) {
  const [tab, setTab] = React.useState<"notes" | "rubric" | "messages">("notes");

  return (
    <div>
      <div className="flex gap-1 border-b border-slate-200" role="tablist" aria-label="Application workspace">
        {(
          [
            ["notes", `Internal notes (${notes.length})`],
            ["rubric", `Ratings (${rubrics.length})`],
            ["messages", `Messages (${messages.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="py-4">
        {tab === "notes" && (
          <NotesSection notes={notes} addAction={noteActions.add} updateAction={noteActions.update} deleteAction={noteActions.remove} />
        )}
        {tab === "rubric" && <RubricSection rubrics={rubrics} existing={existingRubric} saveAction={rubricAction} />}
        {tab === "messages" && <MessagesSection messages={messages} sendAction={messageAction} />}
      </div>
      {tab !== "messages" && (
        <Alert tone="info" title="Visibility">
          Internal notes and ratings are visible only to your hiring team. Candidate-visible communication happens only in the Messages tab.
        </Alert>
      )}
    </div>
  );
}
