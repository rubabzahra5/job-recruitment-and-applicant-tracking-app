"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { handleActionResult } from "@/app/(candidate)/_components/form-helpers";
import type { ActionResult } from "@/app/(candidate)/_components/form-helpers";
import {
  createAlert,
  updateAlert,
  toggleAlert,
  deleteAlert,
  type JobAlertRow,
  type JobCategoryRow,
  type AlertFilters,
} from "../_actions";
import { EMPLOYMENT_TYPES } from "../_lib/employment-types";
import type { LocationRow } from "@/app/(candidate)/_lib/candidate-guard";

const formSchema = z.object({
  name: z.string().trim().min(2, "Give your alert a name.").max(120),
  keyword: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  category_id: z.string().trim().uuid("Unknown job category.").optional().or(z.literal("")),
  employment_type: z.enum(EMPLOYMENT_TYPES).optional().or(z.literal("")),
  is_active: z.boolean(),
});

type FormInput = z.infer<typeof formSchema>;

/** Normalize a stored filter value to the form's employment_type union. */
function toEmploymentType(value: string | undefined): FormInput["employment_type"] {
  return (EMPLOYMENT_TYPES as readonly string[]).includes(value ?? "")
    ? (value as FormInput["employment_type"])
    : "";
}

export interface AlertDefaults {
  name: string;
  keyword: string;
  city: string;
  category_id: string;
  employment_type:
    | ""
    | "full_time"
    | "part_time"
    | "contract"
    | "temporary"
    | "internship"
    | "apprenticeship"
    | "freelance";
}

function describeFilters(f: AlertFilters, categories: JobCategoryRow[]): string {
  const parts: string[] = [];
  if (f.keyword) parts.push(`“${f.keyword}”`);
  if (f.city) parts.push(f.city);
  if (f.category_id) {
    parts.push(categories.find((c) => c.id === f.category_id)?.name ?? "Category");
  }
  if (f.employment_type) parts.push(f.employment_type.replace(/_/g, " "));
  return parts.length > 0 ? parts.join(" · ") : "All jobs";
}

function AlertForm({
  initial,
  defaults,
  categories,
  locations,
  onDone,
}: {
  initial: JobAlertRow | null;
  defaults: AlertDefaults;
  categories: JobCategoryRow[];
  locations: LocationRow[];
  onDone: () => void;
}) {
  const [topError, setTopError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          keyword: initial.filters.keyword ?? "",
          city: initial.filters.city ?? "",
          category_id: initial.filters.category_id ?? "",
          employment_type: toEmploymentType(initial.filters.employment_type),
          is_active: initial.is_active,
        }
      : { ...defaults, is_active: true },
  });

  async function onSubmit(data: FormInput) {
    const payload = {
      name: data.name,
      filters: {
        keyword: data.keyword ?? "",
        city: data.city ?? "",
        category_id: data.category_id ?? "",
        employment_type: data.employment_type ?? "",
      },
      is_active: data.is_active,
    };
    const result: ActionResult = initial
      ? await updateAlert(initial.id, payload)
      : await createAlert(payload);
    if (handleActionResult(result, setError, setTopError)) onDone();
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
      {topError && <Alert tone="error" className="mb-4">{topError}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Alert name" htmlFor="alert-name" required error={errors.name?.message}>
          <Input id="alert-name" {...register("name")} invalid={!!errors.name} placeholder="e.g. Accounting jobs in Lahore" />
        </FormField>
        <FormField label="Keyword" htmlFor="alert-keyword" error={errors.keyword?.message}>
          <Input id="alert-keyword" {...register("keyword")} invalid={!!errors.keyword} placeholder="e.g. accountant" />
        </FormField>
        <FormField label="City" htmlFor="alert-city" error={errors.city?.message}>
          <Select id="alert-city" {...register("city")} invalid={!!errors.city}>
            <option value="">Any city</option>
            {locations.map((l) => (
              <option key={l.id} value={l.city}>{l.city}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Category" htmlFor="alert-category">
          <Select id="alert-category" {...register("category_id")}>
            <option value="">Any category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Employment type" htmlFor="alert-emptype">
          <Select id="alert-emptype" {...register("employment_type")}>
            <option value="">Any type</option>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </Select>
        </FormField>
        <div className="flex items-center gap-2 pt-6">
          <input id="alert-active" type="checkbox" {...register("is_active")} className="h-4 w-4 accent-brand-600" />
          <label htmlFor="alert-active" className="text-sm font-medium text-slate-700">
            Alert is active
          </label>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button type="submit" isLoading={isSubmitting}>
          {initial ? "Save changes" : "Create alert"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AlertManager({
  alerts,
  categories,
  locations,
  prefill,
}: {
  alerts: JobAlertRow[];
  categories: JobCategoryRow[];
  locations: LocationRow[];
  prefill: AlertDefaults | null;
}) {
  const [creating, setCreating] = useState(prefill !== null);
  const [editing, setEditing] = useState<JobAlertRow | null>(null);
  const [deleting, setDeleting] = useState<JobAlertRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(alert: JobAlertRow) {
    setError(null);
    const result = await toggleAlert(alert.id, !alert.is_active);
    if (!result.ok) setError(result.error ?? "Failed to update.");
  }

  async function handleDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    const result = await deleteAlert(deleting.id);
    setBusy(false);
    if (result.ok) setDeleting(null);
    else {
      setError(result.error ?? "Failed to delete.");
      setDeleting(null);
    }
  }

  return (
    <div>
      {error && <Alert tone="error" className="mb-4">{error}</Alert>}

      {creating ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{prefill ? "Create alert from your search" : "New job alert"}</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertForm
              initial={null}
              defaults={prefill ?? { name: "", keyword: "", city: "", category_id: "", employment_type: "" }}
              categories={categories}
              locations={locations}
              onDone={() => setCreating(false)}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="mb-6">
          <Button variant="primary" onClick={() => setCreating(true)}>
            Create job alert
          </Button>
        </div>
      )}

      {editing && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Edit alert</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertForm
              initial={editing}
              defaults={{ name: "", keyword: "", city: "", category_id: "", employment_type: "" }}
              categories={categories}
              locations={locations}
              onDone={() => setEditing(null)}
            />
          </CardContent>
        </Card>
      )}

      {alerts.length === 0 && !creating ? (
        <EmptyState
          title="No job alerts"
          description="Create an alert and we'll notify you when matching jobs are posted."
        />
      ) : (
        <ul className="space-y-3">
          {alerts.map((a) => (
            <li key={a.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                      {a.name}
                      <Badge tone={a.is_active ? "success" : "neutral"}>
                        {a.is_active ? "Active" : "Paused"}
                      </Badge>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{describeFilters(a.filters, categories)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={() => void handleToggle(a)}>
                      {a.is_active ? "Pause" : "Resume"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(a); setCreating(false); }}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(a)} aria-label={`Delete alert ${a.name}`}>
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
        title="Delete this alert?"
        message={`“${deleting?.name}” will be deleted. You won't receive notifications for it anymore.`}
        confirmLabel="Delete"
        danger
        isConfirming={busy}
      />
    </div>
  );
}
