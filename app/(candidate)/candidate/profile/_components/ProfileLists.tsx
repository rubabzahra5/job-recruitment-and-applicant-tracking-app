"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Alert } from "@/components/ui/Alert";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { handleActionResult, zodOutputResolver } from "@/app/(candidate)/_components/form-helpers";
import type { ActionResult } from "@/app/(candidate)/_components/form-helpers";
import {
  educationSchema,
  experienceSchema,
  skillSchema,
  certificationSchema,
  type EducationInput,
  type ExperienceInput,
  type SkillInput,
  type CertificationInput,
} from "../_schemas";
import {
  saveEducation,
  deleteEducation,
  saveExperience,
  deleteExperience,
  addSkill,
  deleteSkill,
  saveCertification,
  deleteCertification,
} from "../_actions";

export interface EducationRow {
  id: string;
  institution: string;
  degree: string;
  field: string | null;
  start_year: number | null;
  end_year: number | null;
  is_current: boolean;
}

export interface ExperienceRow {
  id: string;
  employer: string;
  title: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
}

export interface SkillRow {
  id: string;
  skill: string;
  years: number | null;
}

export interface CertificationRow {
  id: string;
  name: string;
  issuer: string | null;
  issued_date: string | null;
  credential_url: string | null;
}

function yearRange(start: number | null, end: number | null, isCurrent: boolean): string {
  const s = start ?? "—";
  const e = isCurrent ? "Present" : (end ?? "—");
  return `${s} – ${e}`;
}

// ─── Education ──────────────────────────────────────────────────────────────

function EducationDialog({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: EducationRow | null;
}) {
  const [topError, setTopError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EducationInput>({
    resolver: zodOutputResolver(educationSchema),
    defaultValues: {
      institution: initial?.institution ?? "",
      degree: initial?.degree ?? "",
      field: initial?.field ?? "",
      start_year: initial?.start_year ?? undefined,
      end_year: initial?.end_year ?? undefined,
      is_current: initial?.is_current ?? false,
    },
  });
  const isCurrent = watch("is_current");

  async function onSubmit(data: EducationInput) {
    const result: ActionResult = await saveEducation(initial?.id ?? null, data);
    if (handleActionResult(result, setError, setTopError)) onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "Edit education" : "Add education"}>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        {topError && <Alert tone="error" className="mb-4">{topError}</Alert>}
        <div className="space-y-4">
          <FormField label="Institution" htmlFor="edu-institution" required error={errors.institution?.message}>
            <Input id="edu-institution" {...register("institution")} invalid={!!errors.institution} />
          </FormField>
          <FormField label="Degree" htmlFor="edu-degree" required error={errors.degree?.message}>
            <Input id="edu-degree" {...register("degree")} invalid={!!errors.degree} placeholder="e.g. BBA, BS Computer Science" />
          </FormField>
          <FormField label="Field of study" htmlFor="edu-field" error={errors.field?.message}>
            <Input id="edu-field" {...register("field")} invalid={!!errors.field} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start year" htmlFor="edu-start" error={errors.start_year?.message}>
              <Input id="edu-start" {...register("start_year")} type="number" invalid={!!errors.start_year} />
            </FormField>
            <FormField label="End year" htmlFor="edu-end" error={errors.end_year?.message}>
              <Input id="edu-end" {...register("end_year")} type="number" disabled={isCurrent} invalid={!!errors.end_year} />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" {...register("is_current")} className="h-4 w-4 accent-brand-600" />
            Currently studying here
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Save</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

export function EducationManager({ rows }: { rows: EducationRow[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EducationRow | null>(null);
  const [deleting, setDeleting] = useState<EducationRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    const result = await deleteEducation(deleting.id);
    setBusy(false);
    if (result.ok) setDeleting(null);
    else setError(result.error ?? "Failed to delete.");
  }

  return (
    <div>
      {error && <Alert tone="error" className="mb-3">{error}</Alert>}
      {rows.length === 0 ? (
        <EmptyState title="No education added" description="Add your degrees and diplomas." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{r.degree}{r.field ? ` · ${r.field}` : ""}</p>
                <p className="text-sm text-slate-600">{r.institution}</p>
                <p className="text-xs text-slate-400">{yearRange(r.start_year, r.end_year, r.is_current)}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setDialogOpen(true); }}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleting(r)} aria-label={`Delete ${r.degree}`}>✕</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <Button variant="outline" size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          Add education
        </Button>
      </div>
      {dialogOpen && (
        <EducationDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={editing} />
      )}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete education entry?"
        message={`“${deleting?.degree}” at ${deleting?.institution} will be removed from your profile.`}
        confirmLabel="Delete"
        danger
        isConfirming={busy}
      />
    </div>
  );
}

// ─── Experience ─────────────────────────────────────────────────────────────

function ExperienceDialog({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: ExperienceRow | null;
}) {
  const [topError, setTopError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExperienceInput>({
    resolver: zodOutputResolver(experienceSchema),
    defaultValues: {
      employer: initial?.employer ?? "",
      title: initial?.title ?? "",
      start_date: initial?.start_date ?? "",
      end_date: initial?.end_date ?? "",
      is_current: initial?.is_current ?? false,
      description: initial?.description ?? "",
    },
  });
  const isCurrent = watch("is_current");

  async function onSubmit(data: ExperienceInput) {
    const result: ActionResult = await saveExperience(initial?.id ?? null, data);
    if (handleActionResult(result, setError, setTopError)) onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "Edit experience" : "Add experience"}>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        {topError && <Alert tone="error" className="mb-4">{topError}</Alert>}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Employer" htmlFor="exp-employer" required error={errors.employer?.message}>
              <Input id="exp-employer" {...register("employer")} invalid={!!errors.employer} />
            </FormField>
            <FormField label="Job title" htmlFor="exp-title" required error={errors.title?.message}>
              <Input id="exp-title" {...register("title")} invalid={!!errors.title} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start date" htmlFor="exp-start" required error={errors.start_date?.message}>
              <Input id="exp-start" {...register("start_date")} type="date" invalid={!!errors.start_date} />
            </FormField>
            <FormField label="End date" htmlFor="exp-end" error={errors.end_date?.message}>
              <Input id="exp-end" {...register("end_date")} type="date" disabled={isCurrent} invalid={!!errors.end_date} />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" {...register("is_current")} className="h-4 w-4 accent-brand-600" />
            I currently work here
          </label>
          <FormField label="Description" htmlFor="exp-desc" error={errors.description?.message} hint="Key responsibilities and achievements.">
            <Textarea id="exp-desc" {...register("description")} invalid={!!errors.description} rows={4} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Save</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

export function ExperienceManager({ rows }: { rows: ExperienceRow[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExperienceRow | null>(null);
  const [deleting, setDeleting] = useState<ExperienceRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    const result = await deleteExperience(deleting.id);
    setBusy(false);
    if (result.ok) setDeleting(null);
    else setError(result.error ?? "Failed to delete.");
  }

  return (
    <div>
      {error && <Alert tone="error" className="mb-3">{error}</Alert>}
      {rows.length === 0 ? (
        <EmptyState title="No experience added" description="Add your work history, starting with the most recent." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{r.title}</p>
                <p className="text-sm text-slate-600">{r.employer}</p>
                <p className="text-xs text-slate-400">
                  {r.start_date} – {r.is_current ? "Present" : (r.end_date ?? "—")}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setDialogOpen(true); }}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleting(r)} aria-label={`Delete ${r.title} at ${r.employer}`}>✕</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <Button variant="outline" size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          Add experience
        </Button>
      </div>
      {dialogOpen && (
        <ExperienceDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={editing} />
      )}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete experience entry?"
        message={`“${deleting?.title}” at ${deleting?.employer} will be removed from your profile.`}
        confirmLabel="Delete"
        danger
        isConfirming={busy}
      />
    </div>
  );
}

// ─── Skills ─────────────────────────────────────────────────────────────────

export function SkillsManager({ rows }: { rows: SkillRow[] }) {
  const [topError, setTopError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SkillRow | null>(null);
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SkillInput>({
    resolver: zodOutputResolver(skillSchema),
    defaultValues: { skill: "", years: undefined },
  });

  async function onSubmit(data: SkillInput) {
    const result: ActionResult = await addSkill(data);
    if (handleActionResult(result, setError, setTopError)) reset({ skill: "", years: undefined });
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setTopError(null);
    const result = await deleteSkill(deleting.id);
    setBusy(false);
    if (result.ok) setDeleting(null);
    else setTopError(result.error ?? "Failed to delete.");
  }

  return (
    <div>
      {topError && <Alert tone="error" className="mb-3">{topError}</Alert>}
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="flex items-start gap-2">
        <div className="flex-1">
          <FormField label="Skill" htmlFor="skill-name" className="sr-only" error={errors.skill?.message}>
            <Input id="skill-name" {...register("skill")} placeholder="e.g. Excel, Teaching, Driving" aria-label="Skill name" invalid={!!errors.skill} />
          </FormField>
        </div>
        <div className="w-28">
          <FormField label="Years" htmlFor="skill-years" className="sr-only" error={errors.years?.message}>
            <Input id="skill-years" {...register("years")} type="number" min={0} placeholder="Years" aria-label="Years of experience" invalid={!!errors.years} />
          </FormField>
        </div>
        <Button type="submit" size="sm" isLoading={isSubmitting}>Add</Button>
      </form>
      {rows.length === 0 ? (
        <div className="mt-3">
          <EmptyState title="No skills yet" description="Add at least 3 skills — employers search by them." />
        </div>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-3 pr-1.5 text-sm text-slate-700"
            >
              <span>
                {r.skill}
                {r.years != null ? <span className="text-slate-400"> · {r.years}y</span> : null}
              </span>
              <button
                type="button"
                onClick={() => setDeleting(r)}
                aria-label={`Remove skill ${r.skill}`}
                className="rounded-full px-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title="Remove skill?"
        message={`“${deleting?.skill}” will be removed from your profile.`}
        confirmLabel="Remove"
        danger
        isConfirming={busy}
      />
    </div>
  );
}

// ─── Certifications ─────────────────────────────────────────────────────────

function CertificationDialog({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: CertificationRow | null;
}) {
  const [topError, setTopError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CertificationInput>({
    resolver: zodOutputResolver(certificationSchema),
    defaultValues: {
      name: initial?.name ?? "",
      issuer: initial?.issuer ?? "",
      issued_date: initial?.issued_date ?? "",
      credential_url: initial?.credential_url ?? "",
    },
  });

  async function onSubmit(data: CertificationInput) {
    const result: ActionResult = await saveCertification(initial?.id ?? null, data);
    if (handleActionResult(result, setError, setTopError)) onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "Edit certification" : "Add certification"}>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        {topError && <Alert tone="error" className="mb-4">{topError}</Alert>}
        <div className="space-y-4">
          <FormField label="Certification name" htmlFor="cert-name" required error={errors.name?.message}>
            <Input id="cert-name" {...register("name")} invalid={!!errors.name} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Issuer" htmlFor="cert-issuer" error={errors.issuer?.message}>
              <Input id="cert-issuer" {...register("issuer")} invalid={!!errors.issuer} placeholder="e.g. PITB, HEC" />
            </FormField>
            <FormField label="Issued date" htmlFor="cert-date" error={errors.issued_date?.message}>
              <Input id="cert-date" {...register("issued_date")} type="date" invalid={!!errors.issued_date} />
            </FormField>
          </div>
          <FormField label="Credential URL" htmlFor="cert-url" error={errors.credential_url?.message}>
            <Input id="cert-url" {...register("credential_url")} invalid={!!errors.credential_url} placeholder="https://…" />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Save</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

export function CertificationsManager({ rows }: { rows: CertificationRow[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CertificationRow | null>(null);
  const [deleting, setDeleting] = useState<CertificationRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    const result = await deleteCertification(deleting.id);
    setBusy(false);
    if (result.ok) setDeleting(null);
    else setError(result.error ?? "Failed to delete.");
  }

  return (
    <div>
      {error && <Alert tone="error" className="mb-3">{error}</Alert>}
      {rows.length === 0 ? (
        <EmptyState title="No certifications" description="Add professional certifications to stand out." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{r.name}</p>
                <p className="text-xs text-slate-500">
                  {[r.issuer, r.issued_date].filter(Boolean).join(" · ") || "—"}
                </p>
                {r.credential_url && (
                  <a href={r.credential_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-brand-700 hover:underline">
                    View credential
                  </a>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setDialogOpen(true); }}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleting(r)} aria-label={`Delete certification ${r.name}`}>✕</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <Button variant="outline" size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          Add certification
        </Button>
      </div>
      {dialogOpen && (
        <CertificationDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={editing} />
      )}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete certification?"
        message={`“${deleting?.name}” will be removed from your profile.`}
        confirmLabel="Delete"
        danger
        isConfirming={busy}
      />
    </div>
  );
}
