"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { FormField } from "@/components/ui/FormField";
import { Alert } from "@/components/ui/Alert";
import type { ActionResult } from "../_lib/org";
import type { NotificationPrefs } from "../employer/employee/actions";

/** Employee profile editor (display name + job title). */
export function EmployeeProfileForm({
  initial,
  saveAction,
}: {
  initial: { displayName: string | null; title: string | null };
  saveAction: (input: { displayName: string; title: string | null }) => Promise<ActionResult>;
}) {
  const [displayName, setDisplayName] = React.useState(initial.displayName ?? "");
  const [title, setTitle] = React.useState(initial.title ?? "");
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const save = async () => {
    setWorking(true);
    setError(null);
    setSaved(false);
    const res = await saveAction({ displayName: displayName.trim(), title: title.trim() || null });
    setWorking(false);
    if (!res.ok) setError(res.error);
    else {
      setSaved(true);
      window.location.reload();
    }
  };

  return (
    <div className="grid max-w-lg gap-4">
      {error && <Alert tone="error" title="Could not save">{error}</Alert>}
      {saved && <Alert tone="success" title="Saved">Your profile was updated.</Alert>}
      <FormField label="Display name" htmlFor="emp-name" required>
        <Input id="emp-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </FormField>
      <FormField label="Job title" htmlFor="emp-title">
        <Input id="emp-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Software Engineer" />
      </FormField>
      <div>
        <Button onClick={save} disabled={displayName.trim().length < 2} isLoading={working}>
          Save changes
        </Button>
      </div>
    </div>
  );
}

/** HR request composer. */
export function HrRequestForm({
  sendAction,
}: {
  sendAction: (input: { subject: string; message: string }) => Promise<ActionResult>;
}) {
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  const send = async () => {
    setWorking(true);
    setError(null);
    setSent(false);
    const res = await sendAction({ subject: subject.trim(), message: message.trim() });
    setWorking(false);
    if (!res.ok) setError(res.error);
    else {
      setSent(true);
      setSubject("");
      setMessage("");
      window.location.reload();
    }
  };

  return (
    <div className="grid max-w-lg gap-4">
      {error && <Alert tone="error" title="Could not send">{error}</Alert>}
      {sent && <Alert tone="success" title="Request sent">Your HR team has been notified in-app.</Alert>}
      <FormField label="Subject" htmlFor="hr-subject" required>
        <Input id="hr-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Leave balance query" />
      </FormField>
      <FormField label="Message" htmlFor="hr-message" required>
        <Textarea id="hr-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Describe your request…" />
      </FormField>
      <div>
        <Button onClick={send} disabled={subject.trim().length < 3 || message.trim().length < 10} isLoading={working}>
          Send request
        </Button>
      </div>
    </div>
  );
}

/** Notification preferences editor. */
export function NotificationPrefsForm({
  initial,
  saveAction,
}: {
  initial: NotificationPrefs;
  saveAction: (prefs: NotificationPrefs) => Promise<ActionResult>;
}) {
  const [inApp, setInApp] = React.useState(initial.inAppEnabled);
  const [email, setEmail] = React.useState(initial.emailEnabled);
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const save = async () => {
    setWorking(true);
    setError(null);
    setSaved(false);
    const res = await saveAction({ inAppEnabled: inApp, emailEnabled: email });
    setWorking(false);
    if (!res.ok) setError(res.error);
    else setSaved(true);
  };

  return (
    <div className="grid max-w-lg gap-3">
      {error && <Alert tone="error" title="Could not save">{error}</Alert>}
      {saved && <Alert tone="success" title="Saved">Preferences updated.</Alert>}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={inApp} onChange={(e) => setInApp(e.target.checked)} className="h-4 w-4" />
        In-app notifications
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} className="h-4 w-4" />
        Email notifications <span className="text-xs text-slate-500">(only when email is configured)</span>
      </label>
      <div>
        <Button onClick={save} isLoading={working}>
          Save preferences
        </Button>
      </div>
    </div>
  );
}

/** Download button for an employee document (signed URL, own docs only). */
export function EmployeeDocDownload({
  documentId,
  getUrl,
}: {
  documentId: string;
  getUrl: (documentId: string) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
}) {
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const download = async () => {
    setWorking(true);
    setError(null);
    const res = await getUrl(documentId);
    setWorking(false);
    if (!res.ok) setError(res.error);
    else window.open(res.url, "_blank", "noopener,noreferrer");
  };

  return (
    <span>
      <Button size="sm" variant="outline" onClick={download} isLoading={working}>
        Download
      </Button>
      {error && (
        <span className="ml-2 text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
