"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { FormField } from "@/components/ui/FormField";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StageBadge } from "@/app/(candidate)/_components/StageBadge";
import { formatDateKarachi, formatSalaryRange } from "@/lib/format";
import { submitApplication } from "../_actions";

export interface WizardJob {
  title: string;
  slug: string;
  description: string;
  responsibilities: string | null;
  qualifications: string | null;
  skills: string[];
  employment_type: string;
  workplace: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: string;
  salary_disclosed: boolean;
  deadline: string | null;
  experience_min_years: number | null;
  experience_max_years: number | null;
  education_level: string | null;
  is_fresh_graduate_ok: boolean;
  orgName: string;
  city: string | null;
  province: string | null;
  categoryName: string | null;
}

export interface WizardQuestion {
  id: string;
  question: string;
  is_required: boolean;
}

export interface WizardCv {
  id: string;
  file_name: string;
  is_current_cv: boolean;
  created_at: string;
}

const wizardSchema = z.object({
  answers: z.array(
    z.object({ questionId: z.string(), answer: z.string().max(5000) }),
  ),
  documentId: z.string().min(1, "Select a CV to attach to your application."),
  coverLetter: z
    .string()
    .max(10000, "Cover letter must be 10000 characters or less.")
    .optional(),
  consent: z.boolean().refine((v) => v === true, {
    message: "Please accept the privacy consent to submit your application.",
  }),
});

type WizardInput = z.infer<typeof wizardSchema>;

const STEPS = ["Review job", "Questions", "CV & cover letter", "Review & submit"] as const;

function prettyEnum(v: string): string {
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ApplyWizard({
  job,
  questions,
  cvs,
  candidateName,
}: {
  job: WizardJob;
  questions: WizardQuestion[];
  cvs: WizardCv[];
  candidateName: string;
}) {
  const [step, setStep] = useState(0);
  const [topError, setTopError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    trigger,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WizardInput>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      answers: questions.map((q) => ({ questionId: q.id, answer: "" })),
      documentId: cvs.find((c) => c.is_current_cv)?.id ?? cvs[0]?.id ?? "",
      coverLetter: "",
      consent: false,
    },
  });
  const { fields } = useFieldArray({ control, name: "answers" });
  const consent = watch("consent");
  const documentId = watch("documentId");

  async function nextFromQuestions() {
    // Required questions must be answered before continuing.
    let valid = true;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]!;
      if (q.is_required) {
        const ok = await trigger(`answers.${i}.answer`);
        if (!ok) valid = false;
      }
    }
    // Also enforce non-empty required answers (trigger only checks schema).
    questions.forEach((q, i) => {
      if (q.is_required) {
        const val = watch(`answers.${i}.answer`).trim();
        if (!val) {
          setError(`answers.${i}.answer`, {
            type: "manual",
            message: "This question is required.",
          });
          valid = false;
        }
      }
    });
    if (valid) {
      setTopError(null);
      setStep(2);
    }
  }

  async function nextFromCv() {
    const ok = await trigger("documentId");
    if (ok) {
      setTopError(null);
      setStep(3);
    }
  }

  async function onSubmit(data: WizardInput) {
    setTopError(null);
    const result = await submitApplication({
      jobSlug: job.slug,
      answers: data.answers,
      documentId: data.documentId,
      coverLetter: data.coverLetter,
      consent: data.consent,
    });
    if (result.ok && result.applicationId) {
      setSubmittedId(result.applicationId);
      window.scrollTo({ top: 0 });
    } else if (result.code === "ALREADY_APPLIED") {
      setTopError("You've already applied to this job. Check your applications for its status.");
    } else {
      setTopError(result.error ?? "Submission failed. Please try again.");
      window.scrollTo({ top: 0 });
    }
  }

  if (submittedId) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <div aria-hidden="true" className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">
            ✓
          </div>
          <h1 className="text-2xl font-bold">Application submitted</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            Thanks {candidateName.split(" ")[0] ?? "there"} — your application
            for <strong>{job.title}</strong> at {job.orgName} is now with the
            hiring team. We&apos;ll notify you here when its status changes.
          </p>
          <div className="mt-2 flex justify-center">
            <StageBadge stage="applied" />
          </div>
          <div className="mt-6 flex justify-center gap-2">
            <Link href={`/candidate/applications/${submittedId}`}>
              <Button variant="primary">View application</Button>
            </Link>
            <Link href="/jobs">
              <Button variant="outline">Browse more jobs</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <ol className="mb-6 flex flex-wrap gap-2" aria-label="Application steps">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
              i === step
                ? "bg-brand-600 text-white"
                : i < step
                  ? "bg-brand-50 text-brand-700"
                  : "bg-slate-100 text-slate-500"
            }`}
          >
            <span aria-hidden="true">{i + 1}</span> {label}
          </li>
        ))}
      </ol>

      {topError && (
        <Alert tone="error" className="mb-4" title="Couldn't submit">
          {topError}
        </Alert>
      )}

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{job.title}</CardTitle>
              <p className="mt-1 text-sm text-slate-600">
                {job.orgName}
                {job.city ? ` · ${job.city}${job.province ? `, ${job.province}` : ""}` : ""} ·{" "}
                {prettyEnum(job.employment_type)} · {prettyEnum(job.workplace)}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {job.categoryName && <Badge tone="info">{job.categoryName}</Badge>}
                {job.salary_disclosed ? (
                  <Badge tone="neutral">
                    {formatSalaryRange(job.salary_min, job.salary_max, job.salary_period)}
                  </Badge>
                ) : (
                  <Badge tone="neutral">Salary not disclosed</Badge>
                )}
                {job.is_fresh_graduate_ok && <Badge tone="success">Fresh graduates welcome</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {job.deadline && (
                <Alert tone="warning">
                  Applications close on {formatDateKarachi(job.deadline)}.
                </Alert>
              )}
              <section>
                <h3 className="text-sm font-semibold">About this role</h3>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{job.description}</p>
              </section>
              {job.responsibilities && (
                <section>
                  <h3 className="text-sm font-semibold">Responsibilities</h3>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{job.responsibilities}</p>
                </section>
              )}
              {job.qualifications && (
                <section>
                  <h3 className="text-sm font-semibold">Qualifications</h3>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{job.qualifications}</p>
                </section>
              )}
              {(job.experience_min_years != null || job.education_level) && (
                <section>
                  <h3 className="text-sm font-semibold">Requirements</h3>
                  <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                    {job.experience_min_years != null && (
                      <li>
                        {job.experience_min_years}
                        {job.experience_max_years ? `–${job.experience_max_years}` : "+"} years
                        experience
                      </li>
                    )}
                    {job.education_level && <li>{job.education_level}</li>}
                  </ul>
                </section>
              )}
              {job.skills.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold">Skills</h3>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {job.skills.map((s) => (
                      <Badge key={s} tone="neutral">{s}</Badge>
                    ))}
                  </div>
                </section>
              )}
              <div className="flex justify-end">
                <Button type="button" onClick={() => setStep(1)}>
                  Continue to questions
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Application questions</CardTitle>
              <p className="mt-1 text-sm text-slate-600">
                The employer asks these to shortlist candidates. Required
                questions are marked.
              </p>
            </CardHeader>
            <CardContent>
              {questions.length === 0 ? (
                <Alert tone="info">This job has no extra questions.</Alert>
              ) : (
                <div className="space-y-5">
                  {fields.map((field, i) => {
                    const q = questions[i]!;
                    const err = errors.answers?.[i]?.answer?.message;
                    return (
                      <FormField
                        key={field.id}
                        label={q.question}
                        htmlFor={`answer-${i}`}
                        required={q.is_required}
                        error={err}
                      >
                        <Textarea
                          id={`answer-${i}`}
                          {...register(`answers.${i}.answer`)}
                          invalid={!!err}
                          rows={3}
                        />
                      </FormField>
                    );
                  })}
                </div>
              )}
              <div className="mt-6 flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button type="button" onClick={() => void nextFromQuestions()}>
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>CV & cover letter</CardTitle>
            </CardHeader>
            <CardContent>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-700">
                  Select the CV to attach <span aria-hidden="true" className="text-red-600">*</span>
                </legend>
                {cvs.length === 0 ? (
                  <Alert
                    tone="warning"
                    title="No CV uploaded"
                    className="mb-2"
                  >
                    Upload a CV first —{" "}
                    <Link href="/candidate/resume" className="font-medium underline">
                      go to Resume
                    </Link>
                    , then come back here.
                  </Alert>
                ) : (
                  <div className="space-y-2" role="radiogroup" aria-label="Choose a CV">
                    {cvs.map((cv) => (
                      <label
                        key={cv.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm ${
                          documentId === cv.id ? "border-brand-600 bg-brand-50" : "border-slate-200"
                        }`}
                      >
                        <input
                          type="radio"
                          value={cv.id}
                          {...register("documentId")}
                          className="h-4 w-4 accent-brand-600"
                        />
                        <span className="font-medium">{cv.file_name}</span>
                        {cv.is_current_cv && <Badge tone="success">Current</Badge>}
                      </label>
                    ))}
                  </div>
                )}
                {errors.documentId?.message && (
                  <p role="alert" className="mt-1 text-xs text-red-600">{errors.documentId.message}</p>
                )}
              </fieldset>

              <div className="mt-5">
                <FormField
                  label="Cover letter (optional)"
                  htmlFor="coverLetter"
                  error={errors.coverLetter?.message}
                  hint="A few sentences on why you're a good fit."
                >
                  <Textarea
                    id="coverLetter"
                    {...register("coverLetter")}
                    invalid={!!errors.coverLetter}
                    rows={5}
                  />
                </FormField>
              </div>

              <div className="mt-6 flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="button" onClick={() => void nextFromCv()} disabled={cvs.length === 0}>
                  Review application
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Review & submit</CardTitle>
              <p className="mt-1 text-sm text-slate-600">
                Check everything once — you can&apos;t edit an application after submitting.
              </p>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="font-medium text-slate-500">Job</dt>
                  <dd className="font-semibold">{job.title} · {job.orgName}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">CV</dt>
                  <dd>{cvs.find((c) => c.id === documentId)?.file_name ?? "—"}</dd>
                </div>
                {questions.map((q, i) => (
                  <div key={q.id}>
                    <dt className="font-medium text-slate-500">{q.question}</dt>
                    <dd className="whitespace-pre-line text-slate-700">
                      {(watch(`answers.${i}.answer`) || "").trim() || <span className="text-slate-400">—</span>}
                    </dd>
                  </div>
                ))}
                {watch("coverLetter")?.trim() && (
                  <div>
                    <dt className="font-medium text-slate-500">Cover letter</dt>
                    <dd className="whitespace-pre-line text-slate-700">{watch("coverLetter")}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4">
                <label className="flex items-start gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    {...register("consent")}
                    className="mt-1 h-4 w-4 accent-brand-600"
                  />
                  <span>
                    I consent to TalentBridge and {job.orgName} processing my
                    application data (profile, CV and answers) for recruitment
                    purposes. I understand my data is stored securely and I can
                    request export or deletion anytime from the Privacy page.
                  </span>
                </label>
                {errors.consent?.message && (
                  <p role="alert" className="mt-1 text-xs text-red-600">{errors.consent.message}</p>
                )}
              </div>

              <div className="mt-6 flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={isSubmitting}>
                  Back
                </Button>
                <Button type="submit" isLoading={isSubmitting} disabled={!consent}>
                  Submit application
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
}
