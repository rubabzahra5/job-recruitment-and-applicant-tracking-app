"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Alert } from "@/components/ui/Alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { ActionResult } from "../_lib/org";
import type { OfferInput } from "../employer/offers/actions";

const formSchema = z.object({
  applicationId: z.string().min(1, "Select an application."),
  salaryAmount: z.string(),
  salaryPeriod: z.string(),
  joiningDate: z.string(),
  expiresAt: z.string(),
  terms: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

interface OfferFormProps {
  applications: { id: string; label: string }[];
  preselectedApplicationId?: string;
  existing?: {
    salaryAmount: number | null;
    salaryPeriod: string | null;
    joiningDate: string | null;
    expiresAt: string | null;
    terms: string | null;
  } | null;
  saveAction: (input: OfferInput) => Promise<ActionResult>;
  cancelHref: string;
  mode: "create" | "edit";
}

/** Create/edit offer form. Salary is in PKR; visibility is restricted by role on list/detail pages. */
export function OfferForm({ applications, preselectedApplicationId, existing, saveAction, cancelHref, mode }: OfferFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      applicationId: preselectedApplicationId ?? "",
      salaryAmount: existing?.salaryAmount != null ? String(existing.salaryAmount) : "",
      salaryPeriod: existing?.salaryPeriod ?? "monthly",
      joiningDate: existing?.joiningDate ? existing.joiningDate.slice(0, 10) : "",
      expiresAt: "",
      terms: existing?.terms ?? "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setSaving(true);
    try {
      const salary = values.salaryAmount.trim();
      const result = await saveAction({
        applicationId: values.applicationId,
        salaryAmount: salary ? Number(salary) : null,
        salaryPeriod: (values.salaryPeriod || null) as OfferInput["salaryPeriod"],
        joiningDate: values.joiningDate.trim() || null,
        expiresAt: values.expiresAt.trim() || null,
        terms: values.terms.trim() || null,
      });
      if (result.ok) {
        router.push(cancelHref);
        router.refresh();
      } else {
        setServerError(result.error);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "create" ? "Create offer" : "Edit offer"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2" noValidate>
          {serverError && (
            <div className="md:col-span-2">
              <Alert tone="error" title="Could not save the offer">{serverError}</Alert>
            </div>
          )}
          <FormField label="Application" htmlFor="applicationId" required error={errors.applicationId?.message} className="md:col-span-2">
            <Select {...register("applicationId")} invalid={!!errors.applicationId} disabled={!!preselectedApplicationId || mode === "edit"}>
              <option value="">Select…</option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Salary amount (PKR)" htmlFor="salaryAmount" hint="Visible only to org admins and HR managers elsewhere">
            <Input type="number" min={0} {...register("salaryAmount")} placeholder="150000" />
          </FormField>
          <FormField label="Salary period" htmlFor="salaryPeriod">
            <Select {...register("salaryPeriod")}>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
              <option value="hourly">Hourly</option>
              <option value="project">Project</option>
            </Select>
          </FormField>
          <FormField label="Joining date" htmlFor="joiningDate">
            <Input type="date" {...register("joiningDate")} />
          </FormField>
          <FormField label="Offer expires" htmlFor="expiresAt" hint="Asia/Karachi">
            <Input type="datetime-local" {...register("expiresAt")} />
          </FormField>
          <FormField label="Terms" htmlFor="terms" className="md:col-span-2">
            <Textarea {...register("terms")} rows={4} placeholder="Offer terms and conditions…" />
          </FormField>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button type="button" variant="outline" onClick={() => router.push(cancelHref)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              {mode === "create" ? "Create offer (draft)" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
