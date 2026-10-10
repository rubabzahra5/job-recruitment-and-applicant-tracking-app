"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { saveSettings } from "./actions";
import { SETTING_SPECS } from "./settings-spec";

const formSchema = z.object({
  platform_name: z.string().trim().min(1).max(120),
  operating_mode: z.enum(["centralized", "internal"]),
  currency: z.string().trim().min(1).max(10),
  timezone: z.string().trim().min(1).max(60),
  registration_open: z.boolean(),
  employer_approval_required: z.boolean(),
  job_moderation_required: z.boolean(),
  max_active_applications_per_candidate: z.number().int().min(1).max(1000),
  cv_max_file_mb: z.number().int().min(1).max(100),
  cv_allowed_types: z.string().trim().min(1).max(200),
  data_retention_days: z.number().int().min(30).max(3650),
  notify_on_new_application: z.boolean(),
  notify_on_stage_change: z.boolean(),
  privacy_contact_email: z.string().trim().max(200),
  support_email: z.string().trim().max(200),
  support_phone: z.string().trim().max(30),
});

type FormValues = z.infer<typeof formSchema>;

const NUMBER_KEYS = [
  "max_active_applications_per_candidate",
  "cv_max_file_mb",
  "data_retention_days",
];

export function SettingsForm({ initial }: { initial: Record<string, unknown> }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initial as unknown as FormValues,
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    setSaved(false);
    const result = await saveSettings(values);
    if (result.ok) {
      setSaved(true);
      router.refresh();
    } else {
      setError(result.error ?? "Save failed.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {SETTING_SPECS.map((spec) => {
        const fieldError = errors[spec.key as keyof FormValues]?.message as string | undefined;
        const fieldId = `setting-${spec.key}`;
        return (
          <div key={spec.key} className="rounded-lg border border-slate-200 bg-white p-4">
            {spec.type === "boolean" ? (
              <div className="flex items-start gap-3">
                <input
                  id={fieldId}
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-brand-600"
                  {...register(spec.key as "registration_open")}
                />
                <div>
                  <label htmlFor={fieldId} className="text-sm font-medium text-slate-800">
                    {spec.label}
                  </label>
                  <p className="mt-0.5 text-xs text-slate-500">{spec.description}</p>
                </div>
              </div>
            ) : (
              <FormField label={spec.label} htmlFor={fieldId} error={fieldError} hint={spec.description}>
                {spec.type === "select" ? (
                  <Select id={fieldId} {...register(spec.key as "operating_mode")}>
                    {(spec.options ?? []).map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    id={fieldId}
                    type={NUMBER_KEYS.includes(spec.key) ? "number" : "text"}
                    invalid={!!fieldError}
                    {...register(
                      spec.key as "platform_name",
                      NUMBER_KEYS.includes(spec.key) ? { valueAsNumber: true } : undefined,
                    )}
                  />
                )}
              </FormField>
            )}
            <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-400">
              <span className="font-medium text-slate-500">Consumed by:</span> {spec.consumedBy}
            </p>
          </div>
        );
      })}

      {error && <Alert tone="error">{error}</Alert>}
      {saved && <Alert tone="success">Settings saved. Changes are audited.</Alert>}

      <div className="flex justify-end">
        <Button type="submit" isLoading={isSubmitting} disabled={!isDirty && !saved}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
