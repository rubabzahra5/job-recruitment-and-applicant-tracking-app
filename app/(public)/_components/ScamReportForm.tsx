"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { submitScamReport } from "../report-scam/actions";
import { SCAM_TYPES, scamReportSchema, type ScamReportInput } from "../report-scam/_schemas";

type FormValues = ScamReportInput;

export function ScamReportForm() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [setupPending, setSetupPending] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(scamReportSchema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setSetupPending(false);
    const result = await submitScamReport(values);
    if (result.ok) {
      setSent(true);
      return;
    }
    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        setError(field as keyof FormValues, { type: "server", message });
      }
    }
    setSetupPending(!!result.setupPending);
    setServerError(result.error);
  }

  if (sent) {
    return (
      <Alert tone="success" title="Report received — thank you">
        Your report is with our trust &amp; safety team. We aim to acknowledge
        reports within 2 business days and complete an initial review within 5
        business days. If the job is a scam, we will remove it and take action
        against the organisation. If you gave an email address, we&apos;ll let
        you know the outcome in general terms.
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {serverError && (
        <Alert tone={setupPending ? "info" : "error"} title={setupPending ? "Almost there" : "Something went wrong"}>
          {serverError}{" "}
          {setupPending && (
            <Link href="/contact" className="font-semibold underline">
              Go to the contact page
            </Link>
          )}
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Your name (optional)" htmlFor="scam-reporter-name" error={errors.reporterName?.message}>
          <Input {...register("reporterName")} invalid={!!errors.reporterName} autoComplete="name" placeholder="Ali Raza" />
        </FormField>
        <FormField
          label="Your email (optional)"
          htmlFor="scam-reporter-email"
          error={errors.reporterEmail?.message}
          hint="Only used to tell you the outcome."
        >
          <Input {...register("reporterEmail")} invalid={!!errors.reporterEmail} autoComplete="email" placeholder="you@example.com" />
        </FormField>
      </div>
      <FormField
        label="What kind of scam is it?"
        htmlFor="scam-type"
        required
        error={errors.scamType?.message}
      >
        <Select {...register("scamType")} invalid={!!errors.scamType} defaultValue="">
          <option value="" disabled>
            Choose one…
          </option>
          {SCAM_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Organisation name (as shown on the job)"
          htmlFor="scam-org"
          error={errors.organizationName?.message}
        >
          <Input {...register("organizationName")} invalid={!!errors.organizationName} placeholder="e.g. ABC Traders" />
        </FormField>
        <FormField
          label="Job link or job ID (optional)"
          htmlFor="scam-job-link"
          error={errors.jobLink?.message}
          hint="Paste the link to the job post if you have it."
        >
          <Input {...register("jobLink")} invalid={!!errors.jobLink} placeholder="https://…/jobs/…" />
        </FormField>
      </div>
      <FormField
        label="What happened?"
        htmlFor="scam-description"
        required
        error={errors.description?.message}
        hint="Tell us what they asked for, where it happened (on TalentBridge, WhatsApp, email), and when. Do not include your own passwords, PINs or bank details."
      >
        <Textarea {...register("description")} invalid={!!errors.description} rows={6} />
      </FormField>
      <FormField
        label="Evidence links (optional)"
        htmlFor="scam-evidence"
        error={errors.evidenceUrls?.message}
        hint="Links to screenshots or messages stored online, one per line."
      >
        <Textarea {...register("evidenceUrls")} invalid={!!errors.evidenceUrls} rows={2} />
      </FormField>
      <Button type="submit" isLoading={isSubmitting}>
        Send report
      </Button>
      <p className="text-xs text-slate-500">
        You do not need an account to report. Reports are read by the
        TalentBridge team only — the organisation is not told who reported
        them.
      </p>
    </form>
  );
}
