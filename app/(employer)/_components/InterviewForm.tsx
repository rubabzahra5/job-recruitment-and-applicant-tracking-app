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
import type { InterviewInput } from "../employer/interviews/actions";

const formSchema = z.object({
  applicationId: z.string().min(1, "Select an application."),
  scheduledAt: z.string().min(1, "Date and time are required."),
  durationMinutes: z.string().min(1, "Duration is required."),
  format: z.enum(["in_person", "video", "phone"]),
  venue: z.string(),
  meetingLink: z.string(),
  instructions: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

interface InterviewFormProps {
  applications: { id: string; label: string }[];
  interviewers: { userId: string; name: string; role: string | null; title: string | null }[];
  preselectedApplicationId?: string;
  scheduleAction: (input: InterviewInput) => Promise<ActionResult>;
  cancelHref: string;
}

/** Schedule-interview form: Asia/Karachi wall-clock input, interviewer multi-select. */
export function InterviewForm({
  applications,
  interviewers,
  preselectedApplicationId,
  scheduleAction,
  cancelHref,
}: InterviewFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [selectedInterviewers, setSelectedInterviewers] = React.useState<string[]>(
    preselectedApplicationId ? [] : [],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      applicationId: preselectedApplicationId ?? "",
      scheduledAt: "",
      durationMinutes: "30",
      format: "video",
      venue: "",
      meetingLink: "",
      instructions: "",
    },
  });

  const toggleInterviewer = (id: string) =>
    setSelectedInterviewers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    if (selectedInterviewers.length === 0) {
      setServerError("Select at least one interviewer.");
      return;
    }
    const link = values.meetingLink.trim();
    if (link && !/^https?:\/\//i.test(link)) {
      setServerError("Meeting link must be a valid http(s) URL.");
      return;
    }
    setSaving(true);
    try {
      const result = await scheduleAction({
        applicationId: values.applicationId,
        scheduledAt: values.scheduledAt,
        durationMinutes: Math.max(5, Math.min(480, Number(values.durationMinutes) || 30)),
        format: values.format,
        venue: values.venue.trim() || undefined,
        meetingLink: link || undefined,
        interviewerUserIds: selectedInterviewers,
        instructions: values.instructions.trim() || undefined,
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
        <CardTitle>Schedule interview</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2" noValidate>
          {serverError && (
            <div className="md:col-span-2">
              <Alert tone="error" title="Could not schedule">
                {serverError}
              </Alert>
            </div>
          )}
          <FormField label="Application" htmlFor="applicationId" required error={errors.applicationId?.message} className="md:col-span-2">
            <Select {...register("applicationId")} invalid={!!errors.applicationId} disabled={!!preselectedApplicationId}>
              <option value="">Select…</option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Date & time" htmlFor="scheduledAt" required hint="Asia/Karachi" error={errors.scheduledAt?.message}>
            <Input type="datetime-local" {...register("scheduledAt")} invalid={!!errors.scheduledAt} />
          </FormField>
          <FormField label="Duration (minutes)" htmlFor="durationMinutes" required error={errors.durationMinutes?.message}>
            <Input type="number" min={5} max={480} {...register("durationMinutes")} invalid={!!errors.durationMinutes} />
          </FormField>
          <FormField label="Format" htmlFor="format" required>
            <Select {...register("format")}>
              <option value="video">Video</option>
              <option value="in_person">In person</option>
              <option value="phone">Phone</option>
            </Select>
          </FormField>
          <FormField label="Venue" htmlFor="venue" hint="Required for in-person interviews">
            <Input {...register("venue")} placeholder="Office address…" />
          </FormField>
          <FormField label="Meeting link" htmlFor="meetingLink" hint="Only add a genuine link — never invent one" className="md:col-span-2">
            <Input {...register("meetingLink")} placeholder="https://…" inputMode="url" />
          </FormField>
          <FormField label="Instructions for candidate" htmlFor="instructions" className="md:col-span-2">
            <Textarea {...register("instructions")} rows={3} placeholder="What to bring, who they'll meet…" />
          </FormField>
          <fieldset className="md:col-span-2">
            <legend className="text-sm font-medium text-slate-700">
              Interviewers <span className="text-red-600">*</span>
            </legend>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {interviewers.map((iv) => (
                <label key={iv.userId} className="flex items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedInterviewers.includes(iv.userId)}
                    onChange={() => toggleInterviewer(iv.userId)}
                    className="h-4 w-4"
                  />
                  <span>
                    {iv.name}
                    <span className="ml-1 text-xs text-slate-500">
                      {iv.title ?? iv.role?.replace("_", " ") ?? ""}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button type="button" variant="outline" onClick={() => router.push(cancelHref)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              Schedule interview
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
