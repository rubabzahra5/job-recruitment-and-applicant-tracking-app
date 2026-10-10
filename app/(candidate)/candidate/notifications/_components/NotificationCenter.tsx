"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { timeAgo } from "@/lib/format";
import {
  markRead,
  markUnread,
  markAllRead,
  savePreferences,
  type NotificationItem,
} from "../_actions";
import { DEFAULT_PREFS, type NotificationPrefs } from "../_lib/prefs";

const TYPE_LABELS: Record<string, string> = {
  application_submitted: "Application",
  application_status: "Application",
  application_withdrawn: "Application",
  interview_scheduled: "Interview",
  message_received: "Message",
  job_alert: "Job alert",
};

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

function NotificationRow({ item }: { item: NotificationItem }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    setError(null);
    const result = item.is_read
      ? await markUnread(item.id)
      : await markRead(item.id);
    setBusy(false);
    if (!result.ok) setError(result.error ?? "Failed to update.");
  }

  const body = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">{typeLabel(item.type)}</Badge>
        {!item.is_read && (
          <span aria-label="Unread" className="h-2 w-2 rounded-full bg-brand-600" />
        )}
        <span className="text-xs text-slate-400">{timeAgo(item.created_at)}</span>
      </div>
      <p className={`mt-1 text-sm ${item.is_read ? "text-slate-700" : "font-semibold text-slate-900"}`}>
        {item.title}
      </p>
      {item.body && <p className="mt-0.5 text-sm text-slate-600">{item.body}</p>}
    </>
  );

  return (
    <li className={`rounded-lg border p-4 ${item.is_read ? "border-slate-200 bg-white" : "border-brand-200 bg-brand-50/40"}`}>
      {error && <Alert tone="error" className="mb-2">{error}</Alert>}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {item.link ? (
            <Link href={item.link} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded">
              {body}
            </Link>
          ) : (
            body
          )}
        </div>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void toggle()}>
          {item.is_read ? "Mark unread" : "Mark read"}
        </Button>
      </div>
    </li>
  );
}

const PREF_FIELDS: Array<{ key: keyof NotificationPrefs; label: string; hint: string }> = [
  { key: "in_app", label: "In-app notifications", hint: "Show updates in your portal inbox (always available)." },
  { key: "email", label: "Email notifications", hint: "Send copies to your account email address." },
  { key: "sms", label: "SMS notifications", hint: "Text-message alerts for interviews and offers." },
  { key: "application_updates", label: "Application updates", hint: "Status changes on your applications." },
  { key: "interview_reminders", label: "Interview reminders", hint: "Reminders before scheduled interviews." },
  { key: "job_alert_digests", label: "Job alert digests", hint: "New jobs matching your alerts." },
];

function PreferencesForm({
  initial,
  emailConfigured,
}: {
  initial: NotificationPrefs;
  emailConfigured: boolean;
}) {
  const [topError, setTopError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<NotificationPrefs>({
    defaultValues: { ...DEFAULT_PREFS, ...initial },
  });

  async function onSubmit(data: NotificationPrefs) {
    setSaved(false);
    setTopError(null);
    const result = await savePreferences(data);
    if (result.ok) setSaved(true);
    else setTopError(result.error ?? "Failed to save.");
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
      {topError && <Alert tone="error" className="mb-4">{topError}</Alert>}
      {saved && <Alert tone="success" className="mb-4">Preferences saved.</Alert>}
      {!emailConfigured && (
        <Alert tone="warning" className="mb-4" title="Email channel not configured">
          Email delivery isn&apos;t set up on this platform yet, so email
          notifications can&apos;t be sent right now — even if you turn them on
          here. In-app notifications always work and are the primary channel.
          Nothing is claimed as sent when it isn&apos;t.
        </Alert>
      )}
      <ul className="space-y-3">
        {PREF_FIELDS.map((f) => (
          <li key={f.key} className="flex items-start gap-3 rounded-md border border-slate-200 p-3">
            <input
              id={`pref-${f.key}`}
              type="checkbox"
              {...register(f.key)}
              className="mt-1 h-4 w-4 accent-brand-600"
            />
            <div>
              <label htmlFor={`pref-${f.key}`} className="text-sm font-medium text-slate-700">
                {f.label}
              </label>
              <p className="text-xs text-slate-500">{f.hint}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <Button type="submit" isLoading={isSubmitting}>Save preferences</Button>
      </div>
    </form>
  );
}

export function NotificationCenter({
  items,
  prefs,
  emailConfigured,
}: {
  items: NotificationItem[];
  prefs: NotificationPrefs;
  emailConfigured: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const unread = items.filter((i) => !i.is_read).length;

  async function handleMarkAll() {
    setBusy(true);
    await markAllRead();
    setBusy(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            {unread > 0 ? `${unread} unread` : "All caught up"}
          </p>
          {unread > 0 && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void handleMarkAll()}>
              Mark all as read
            </Button>
          )}
        </div>
        {items.length === 0 ? (
          <EmptyState
            title="No notifications"
            description="Application updates, interview invites and job alerts will appear here."
          />
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <NotificationRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </div>
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <PreferencesForm initial={prefs} emailConfigured={emailConfigured} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
