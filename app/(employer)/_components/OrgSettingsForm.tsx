"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Alert } from "@/components/ui/Alert";
import type { ActionResult, OrgSettings } from "../_lib/org";
import type { OrgSettingsInput } from "../employer/settings/actions";

/** Organization settings editor (org_admin only). */
export function OrgSettingsForm({
  initial,
  saveAction,
}: {
  initial: OrgSettings;
  saveAction: (input: OrgSettingsInput) => Promise<ActionResult>;
}) {
  const [maxPostings, setMaxPostings] = React.useState(initial.max_active_job_postings != null ? String(initial.max_active_job_postings) : "");
  const [deadlineDays, setDeadlineDays] = React.useState(initial.default_deadline_days != null ? String(initial.default_deadline_days) : "30");
  const [notify, setNotify] = React.useState(initial.notify_recruiters_on_new_application);
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const save = async () => {
    setWorking(true);
    setError(null);
    setSaved(false);
    const res = await saveAction({
      max_active_job_postings: maxPostings.trim() ? Number(maxPostings) : null,
      default_deadline_days: deadlineDays.trim() ? Number(deadlineDays) : null,
      notify_recruiters_on_new_application: notify,
    });
    setWorking(false);
    if (!res.ok) setError(res.error);
    else setSaved(true);
  };

  return (
    <div className="grid gap-4">
      {error && <Alert tone="error" title="Could not save">{error}</Alert>}
      {saved && <Alert tone="success" title="Saved">Settings updated.</Alert>}

      <FormField
        label="Maximum active job postings"
        htmlFor="set-max-postings"
        hint="Publishing is blocked beyond this limit. Leave empty for no limit. Enforced when publishing jobs."
      >
        <Input
          id="set-max-postings"
          type="number"
          min={1}
          value={maxPostings}
          onChange={(e) => setMaxPostings(e.target.value)}
          placeholder="No limit"
          className="max-w-xs"
        />
      </FormField>

      <FormField
        label="Default application deadline (days)"
        htmlFor="set-deadline-days"
        hint="Pre-fills the deadline when posting a job (Asia/Karachi)."
      >
        <Input
          id="set-deadline-days"
          type="number"
          min={1}
          max={365}
          value={deadlineDays}
          onChange={(e) => setDeadlineDays(e.target.value)}
          className="max-w-xs"
        />
      </FormField>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-0.5 h-4 w-4" />
        <span>
          <span className="font-medium">Notify recruiters on new applications</span>
          <span className="block text-xs text-slate-500">
            Contract for the application intake: when enabled, recruiters get an in-app notification for each new application.
          </span>
        </span>
      </label>

      <div>
        <Button onClick={save} isLoading={working}>
          Save settings
        </Button>
      </div>
    </div>
  );
}
