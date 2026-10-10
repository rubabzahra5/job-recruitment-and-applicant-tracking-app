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
import { utcToKarachiInput } from "../_lib/job-text";
import {
  EMPLOYMENT_TYPES,
  WORKPLACES,
  SALARY_PERIODS,
  type JobPayload,
} from "../employer/jobs/job-schema";

/** Loose form-level schema (strings from inputs); normalized to JobPayload on submit. */
const formSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(200),
  departmentId: z.string(),
  categoryId: z.string(),
  locationId: z.string(),
  description: z.string().trim().min(20, "Description must be at least 20 characters."),
  responsibilities: z.string(),
  qualifications: z.string(),
  skillsText: z.string(),
  experienceMin: z.string(),
  experienceMax: z.string(),
  educationLevel: z.string(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  workplace: z.enum(WORKPLACES),
  salaryMin: z.string(),
  salaryMax: z.string(),
  salaryPeriod: z.enum(SALARY_PERIODS),
  salaryDisclosed: z.boolean(),
  openings: z.string().min(1, "Openings is required."),
  isFreshGraduateOk: z.boolean(),
  deadline: z.string(),
  benefits: z.string(),
  instructions: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

export interface JobFormDefaults {
  title: string;
  departmentId: string | null;
  categoryId: string | null;
  locationId: string | null;
  description: string;
  responsibilities: string | null;
  qualifications: string | null;
  skills: string[];
  experienceMin: number | null;
  experienceMax: number | null;
  educationLevel: string | null;
  employmentType: string;
  workplace: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: string;
  salaryDisclosed: boolean;
  openings: number;
  isFreshGraduateOk: boolean;
  deadline: string | null; // ISO UTC
  benefits: string;
  instructions: string;
}

interface JobFormProps {
  departments: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  locations: { id: string; label: string }[];
  defaultDeadlineDays: number;
  defaults?: JobFormDefaults | null;
  initialQuestions?: { question: string; isRequired: boolean }[];
  mode: "create" | "edit";
  saveAction: (payload: JobPayload) => Promise<ActionResult>;
  successRedirect: string;
  cancelHref: string;
}

const numOrNull = (v: string): number | null => {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export function JobForm({
  departments,
  categories,
  locations,
  defaultDeadlineDays,
  defaults,
  initialQuestions = [],
  mode,
  saveAction,
  successRedirect,
  cancelHref,
}: JobFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [questions, setQuestions] = React.useState(initialQuestions);
  const [questionDraft, setQuestionDraft] = React.useState("");
  const [questionRequired, setQuestionRequired] = React.useState(false);

  const defaultDeadline = React.useMemo(() => {
    if (defaults?.deadline) return utcToKarachiInput(defaults.deadline);
    const d = new Date(Date.now() + defaultDeadlineDays * 86_400_000);
    return utcToKarachiInput(d.toISOString());
  }, [defaults, defaultDeadlineDays]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: defaults?.title ?? "",
      departmentId: defaults?.departmentId ?? "",
      categoryId: defaults?.categoryId ?? "",
      locationId: defaults?.locationId ?? "",
      description: defaults?.description ?? "",
      responsibilities: defaults?.responsibilities ?? "",
      qualifications: defaults?.qualifications ?? "",
      skillsText: (defaults?.skills ?? []).join(", "),
      experienceMin: defaults?.experienceMin != null ? String(defaults.experienceMin) : "",
      experienceMax: defaults?.experienceMax != null ? String(defaults.experienceMax) : "",
      educationLevel: defaults?.educationLevel ?? "",
      employmentType: (defaults?.employmentType as FormValues["employmentType"]) ?? "full_time",
      workplace: (defaults?.workplace as FormValues["workplace"]) ?? "on_site",
      salaryMin: defaults?.salaryMin != null ? String(defaults.salaryMin) : "",
      salaryMax: defaults?.salaryMax != null ? String(defaults.salaryMax) : "",
      salaryPeriod: (defaults?.salaryPeriod as FormValues["salaryPeriod"]) ?? "monthly",
      salaryDisclosed: defaults?.salaryDisclosed ?? false,
      openings: defaults ? String(defaults.openings) : "1",
      isFreshGraduateOk: defaults?.isFreshGraduateOk ?? false,
      deadline: defaultDeadline,
      benefits: defaults?.benefits ?? "",
      instructions: defaults?.instructions ?? "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setSaving(true);
    try {
      const payload: JobPayload = {
        title: values.title.trim(),
        departmentId: values.departmentId || null,
        categoryId: values.categoryId || null,
        locationId: values.locationId || null,
        description: values.description.trim(),
        responsibilities: values.responsibilities.trim() || null,
        qualifications: values.qualifications.trim() || null,
        skills: values.skillsText.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50),
        experienceMin: numOrNull(values.experienceMin),
        experienceMax: numOrNull(values.experienceMax),
        educationLevel: values.educationLevel.trim() || null,
        employmentType: values.employmentType,
        workplace: values.workplace,
        salaryMin: numOrNull(values.salaryMin),
        salaryMax: numOrNull(values.salaryMax),
        salaryPeriod: values.salaryPeriod,
        salaryDisclosed: values.salaryDisclosed,
        openings: Math.max(1, Math.floor(Number(values.openings) || 1)),
        isFreshGraduateOk: values.isFreshGraduateOk,
        deadline: values.deadline.trim() || null,
        benefits: values.benefits,
        instructions: values.instructions,
        questions,
      };
      const result = await saveAction(payload);
      if (result.ok) {
        router.push(successRedirect);
        router.refresh();
      } else {
        setServerError(result.error);
      }
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Failed to save job.");
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = () => {
    const q = questionDraft.trim();
    if (!q || questions.length >= 20) return;
    setQuestions([...questions, { question: q, isRequired: questionRequired }]);
    setQuestionDraft("");
    setQuestionRequired(false);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {serverError && (
        <Alert tone="error" title="Could not save the job">
          {serverError}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Basic information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Job title" htmlFor="title" required error={errors.title?.message} className="md:col-span-2">
            <Input {...register("title")} placeholder="e.g. Senior Frontend Developer" invalid={!!errors.title} />
          </FormField>
          <FormField label="Department" htmlFor="departmentId">
            <Select {...register("departmentId")}>
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Category" htmlFor="categoryId">
            <Select {...register("categoryId")}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Location" htmlFor="locationId">
            <Select {...register("locationId")}>
              <option value="">No location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Application deadline" htmlFor="deadline" hint="Asia/Karachi time">
            <Input type="datetime-local" {...register("deadline")} />
          </FormField>
          <FormField label="Employment type" htmlFor="employmentType" required>
            <Select {...register("employmentType")}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace("_", " ")}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Workplace" htmlFor="workplace" required>
            <Select {...register("workplace")}>
              {WORKPLACES.map((w) => (
                <option key={w} value={w}>{w.replace("_", " ")}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Openings" htmlFor="openings" required error={errors.openings?.message}>
            <Input type="number" min={1} {...register("openings")} invalid={!!errors.openings} />
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("isFreshGraduateOk")} className="h-4 w-4" />
            Open to fresh graduates
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormField label="Description" htmlFor="description" required error={errors.description?.message}>
            <Textarea {...register("description")} rows={6} invalid={!!errors.description} />
          </FormField>
          <FormField label="Responsibilities" htmlFor="responsibilities">
            <Textarea {...register("responsibilities")} rows={4} />
          </FormField>
          <FormField label="Qualifications" htmlFor="qualifications">
            <Textarea {...register("qualifications")} rows={4} />
          </FormField>
          <FormField label="Benefits" htmlFor="benefits" hint="Stored as a labeled section in the posting.">
            <Textarea {...register("benefits")} rows={3} />
          </FormField>
          <FormField label="Application instructions" htmlFor="instructions" hint="Stored as a labeled section in the posting.">
            <Textarea {...register("instructions")} rows={3} />
          </FormField>
          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="Skills (comma separated)" htmlFor="skillsText">
              <Input {...register("skillsText")} placeholder="React, TypeScript, …" />
            </FormField>
            <FormField label="Min experience (years)" htmlFor="experienceMin">
              <Input type="number" min={0} step="0.5" {...register("experienceMin")} />
            </FormField>
            <FormField label="Max experience (years)" htmlFor="experienceMax">
              <Input type="number" min={0} step="0.5" {...register("experienceMax")} />
            </FormField>
          </div>
          <FormField label="Education level" htmlFor="educationLevel">
            <Input {...register("educationLevel")} placeholder="e.g. Bachelor's in Computer Science" />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compensation (PKR)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <FormField label="Minimum salary" htmlFor="salaryMin">
            <Input type="number" min={0} {...register("salaryMin")} placeholder="80000" />
          </FormField>
          <FormField label="Maximum salary" htmlFor="salaryMax">
            <Input type="number" min={0} {...register("salaryMax")} placeholder="120000" />
          </FormField>
          <FormField label="Salary period" htmlFor="salaryPeriod">
            <Select {...register("salaryPeriod")}>
              {SALARY_PERIODS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </FormField>
          <label className="flex items-center gap-2 text-sm md:col-span-3">
            <input type="checkbox" {...register("salaryDisclosed")} className="h-4 w-4" />
            Disclose salary on the public posting
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Screening questions ({questions.length}/20)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {questions.length === 0 ? (
            <p className="text-sm text-slate-500">No screening questions yet. Add optional questions candidates must answer when applying.</p>
          ) : (
            <ul className="space-y-2">
              {questions.map((q, i) => (
                <li key={i} className="flex items-start justify-between gap-2 rounded border border-slate-200 p-2 text-sm">
                  <span>
                    {i + 1}. {q.question}
                    {q.isRequired && <span className="ml-2 text-xs font-medium text-red-600">Required</span>}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuestions(questions.filter((_, j) => j !== i))}
                    aria-label={`Remove question ${i + 1}`}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <Input
                value={questionDraft}
                onChange={(e) => setQuestionDraft(e.target.value)}
                placeholder="e.g. Do you have experience with…?"
                aria-label="New screening question"
              />
            </div>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={questionRequired}
                onChange={(e) => setQuestionRequired(e.target.checked)}
                className="h-4 w-4"
              />
              Required
            </label>
            <Button type="button" variant="outline" onClick={addQuestion} disabled={!questionDraft.trim()}>
              Add question
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push(cancelHref)}>
          Cancel
        </Button>
        <Button type="submit" isLoading={saving}>
          {mode === "create" ? "Create job (draft)" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
