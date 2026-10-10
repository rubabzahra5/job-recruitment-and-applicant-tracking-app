"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Alert } from "@/components/ui/Alert";
import { handleActionResult, zodOutputResolver } from "@/app/(candidate)/_components/form-helpers";
import type { ActionResult } from "@/app/(candidate)/_components/form-helpers";
import {
  contactSchema,
  summarySchema,
  preferencesSchema,
  portfolioSchema,
  languagesSchema,
  AVAILABILITY_OPTIONS,
  PROFICIENCY_OPTIONS,
  type ContactInput,
  type SummaryInput,
  type PreferencesInput,
  type PortfolioInput,
  type LanguagesInput,
} from "../_schemas";
import {
  updateContact,
  updateSummary,
  updatePreferences,
  updatePortfolio,
  updateLanguages,
} from "../_actions";
import type { CandidateProfile, LocationRow } from "@/app/(candidate)/_lib/candidate-guard";
import { formatPKR } from "@/lib/format";

interface WithProfile {
  profile: CandidateProfile;
}

// ─── Contact ────────────────────────────────────────────────────────────────

export function ContactForm({ profile, locations }: WithProfile & { locations: LocationRow[] }) {
  const [topError, setTopError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      full_name: profile.full_name ?? "",
      headline: profile.headline ?? "",
      phone: profile.phone ?? "",
      city: profile.city ?? "",
      province: profile.province ?? "",
    },
  });

  const cityValue = watch("city");
  const provinceForCity = locations.find((l) => l.city === cityValue)?.province ?? "";

  function onCityChange(city: string) {
    setValue("city", city, { shouldDirty: true });
    const loc = locations.find((l) => l.city === city);
    setValue("province", loc?.province ?? "", { shouldDirty: true });
  }

  async function onSubmit(data: ContactInput) {
    setSaved(false);
    const result: ActionResult = await updateContact(data);
    if (handleActionResult(result, setError, setTopError)) setSaved(true);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
      {topError && <Alert tone="error" className="mb-4">{topError}</Alert>}
      {saved && <Alert tone="success" className="mb-4">Contact details saved.</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Full name" htmlFor="full_name" required error={errors.full_name?.message}>
          <Input {...register("full_name")} invalid={!!errors.full_name} />
        </FormField>
        <FormField label="Headline" htmlFor="headline" error={errors.headline?.message} hint="e.g. Senior Accountant · 6 yrs in FMCG">
          <Input {...register("headline")} invalid={!!errors.headline} />
        </FormField>
        <FormField
          label="Phone"
          htmlFor="phone"
          error={errors.phone?.message}
          hint="Pakistani mobile (03001234567) or any international number with +."
        >
          <Input {...register("phone")} invalid={!!errors.phone} placeholder="03001234567" inputMode="tel" />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="City" htmlFor="city" error={errors.city?.message}>
            <Select
              value={cityValue}
              onChange={(e) => onCityChange(e.target.value)}
              invalid={!!errors.city}
            >
              <option value="">Select city…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.city}>
                  {l.city}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Province" htmlFor="province">
            <Input id="province" value={provinceForCity} readOnly disabled aria-label="Province (from city)" />
          </FormField>
        </div>
      </div>
      <div className="mt-4">
        <Button type="submit" isLoading={isSubmitting}>Save contact details</Button>
      </div>
    </form>
  );
}

// ─── Summary ────────────────────────────────────────────────────────────────

export function SummaryForm({ profile }: WithProfile) {
  const [topError, setTopError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SummaryInput>({
    resolver: zodResolver(summarySchema),
    defaultValues: { summary: profile.summary ?? "" },
  });

  async function onSubmit(data: SummaryInput) {
    setSaved(false);
    const result: ActionResult = await updateSummary(data);
    if (handleActionResult(result, setError, setTopError)) setSaved(true);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
      {topError && <Alert tone="error" className="mb-4">{topError}</Alert>}
      {saved && <Alert tone="success" className="mb-4">Summary saved.</Alert>}
      <FormField
        label="Professional summary"
        htmlFor="summary"
        error={errors.summary?.message}
        hint="2–4 sentences on your experience, strengths and what you're looking for."
      >
        <Textarea {...register("summary")} invalid={!!errors.summary} rows={5} />
      </FormField>
      <div className="mt-4">
        <Button type="submit" isLoading={isSubmitting}>Save summary</Button>
      </div>
    </form>
  );
}

// ─── Preferences ────────────────────────────────────────────────────────────

export function PreferencesForm({ profile }: WithProfile) {
  const [topError, setTopError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PreferencesInput>({
    resolver: zodOutputResolver(preferencesSchema),
    defaultValues: {
      availability: (AVAILABILITY_OPTIONS as readonly string[]).includes(profile.availability ?? "")
        ? (profile.availability as PreferencesInput["availability"])
        : "",
      expected_salary: profile.expected_salary ?? undefined,
      notice_period_days: profile.notice_period_days ?? undefined,
      is_searchable: profile.is_searchable,
    },
  });

  async function onSubmit(data: PreferencesInput) {
    setSaved(false);
    const result: ActionResult = await updatePreferences(data);
    if (handleActionResult(result, setError, setTopError)) setSaved(true);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
      {topError && <Alert tone="error" className="mb-4">{topError}</Alert>}
      {saved && <Alert tone="success" className="mb-4">Preferences saved.</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Availability" htmlFor="availability" error={errors.availability?.message}>
          <Select {...register("availability")} invalid={!!errors.availability}>
            <option value="">Select…</option>
            {AVAILABILITY_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Expected salary (PKR / month)"
          htmlFor="expected_salary"
          error={errors.expected_salary?.message}
          hint="Optional. Only shown to employers you apply to."
        >
          <Input
            {...register("expected_salary")}
            invalid={!!errors.expected_salary}
            type="number"
            min={0}
            placeholder="e.g. 85000"
          />
        </FormField>
        <FormField
          label="Notice period (days)"
          htmlFor="notice_period_days"
          error={errors.notice_period_days?.message}
        >
          <Input
            {...register("notice_period_days")}
            invalid={!!errors.notice_period_days}
            type="number"
            min={0}
            max={365}
            placeholder="e.g. 30"
          />
        </FormField>
        <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <input
            id="is_searchable"
            type="checkbox"
            {...register("is_searchable")}
            className="mt-1 h-4 w-4 rounded border-slate-300 accent-brand-600"
          />
          <div>
            <label htmlFor="is_searchable" className="text-sm font-medium text-slate-700">
              Let employers find my profile
            </label>
            <p className="text-xs text-slate-500">
              Off by default. When on, recruiters can discover your profile in
              candidate search. Your contact details are only shared with
              employers you apply to.
            </p>
          </div>
        </div>
      </div>
      {profile.expected_salary != null && (
        <p className="mt-2 text-sm text-slate-600">
          Current: <span className="font-medium">{formatPKR(profile.expected_salary)}</span>/month
        </p>
      )}
      <div className="mt-4">
        <Button type="submit" isLoading={isSubmitting}>Save preferences</Button>
      </div>
    </form>
  );
}

// ─── Portfolio links ────────────────────────────────────────────────────────

export interface PortfolioDefaults {
  links: Array<{ label: string; url: string }>;
}

export function PortfolioForm({ defaults }: { defaults: PortfolioDefaults }) {
  const [topError, setTopError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PortfolioInput>({
    resolver: zodResolver(portfolioSchema),
    defaultValues: { links: defaults.links.length > 0 ? defaults.links : [{ label: "", url: "" }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "links" });

  async function onSubmit(data: PortfolioInput) {
    setSaved(false);
    const cleaned = data.links.filter((l) => l.url.trim() !== "");
    const result: ActionResult = await updatePortfolio({ links: cleaned });
    if (handleActionResult(result, setError, setTopError)) setSaved(true);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
      {topError && <Alert tone="error" className="mb-4">{topError}</Alert>}
      {saved && <Alert tone="success" className="mb-4">Portfolio links saved.</Alert>}
      <div className="space-y-3">
        {fields.map((field, i) => (
          <div key={field.id} className="flex items-start gap-2">
            <div className="flex-1">
              <FormField label={`Link ${i + 1} label`} htmlFor={`link-label-${i}`} className="sr-only">
                <Input
                  id={`link-label-${i}`}
                  {...register(`links.${i}.label`)}
                  placeholder="Label (e.g. GitHub)"
                  aria-label={`Link ${i + 1} label`}
                />
              </FormField>
            </div>
            <div className="flex-[2]">
              <FormField
                label={`Link ${i + 1} URL`}
                htmlFor={`link-url-${i}`}
                className="sr-only"
                error={errors.links?.[i]?.url?.message}
              >
                <Input
                  id={`link-url-${i}`}
                  {...register(`links.${i}.url`)}
                  placeholder="https://…"
                  aria-label={`Link ${i + 1} URL`}
                  invalid={!!errors.links?.[i]?.url}
                />
              </FormField>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)} aria-label={`Remove link ${i + 1}`}>
              ✕
            </Button>
          </div>
        ))}
      </div>
      {errors.links?.message && <p role="alert" className="mt-2 text-xs text-red-600">{errors.links.message}</p>}
      <div className="mt-3 flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => append({ label: "", url: "" })}>
          Add link
        </Button>
        <Button type="submit" size="sm" isLoading={isSubmitting}>Save links</Button>
      </div>
    </form>
  );
}

// ─── Languages ──────────────────────────────────────────────────────────────

export interface LanguageDefaults {
  languages: Array<{ language: string; proficiency: string }>;
}

export function LanguagesForm({ defaults }: { defaults: LanguageDefaults }) {
  const [topError, setTopError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LanguagesInput>({
    resolver: zodResolver(languagesSchema),
    defaultValues: {
      languages:
        defaults.languages.length > 0
          ? defaults.languages.map((l) => ({
              language: l.language,
              proficiency: (PROFICIENCY_OPTIONS as readonly string[]).includes(l.proficiency)
                ? (l.proficiency as LanguagesInput["languages"][number]["proficiency"])
                : "Conversational",
            }))
          : [{ language: "", proficiency: "Conversational" as const }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "languages" });

  async function onSubmit(data: LanguagesInput) {
    setSaved(false);
    const cleaned = data.languages.filter((l) => l.language.trim() !== "");
    const result: ActionResult = await updateLanguages({ languages: cleaned });
    if (handleActionResult(result, setError, setTopError)) setSaved(true);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
      {topError && <Alert tone="error" className="mb-4">{topError}</Alert>}
      {saved && <Alert tone="success" className="mb-4">Languages saved.</Alert>}
      <div className="space-y-3">
        {fields.map((field, i) => (
          <div key={field.id} className="flex items-start gap-2">
            <div className="flex-1">
              <FormField
                label={`Language ${i + 1}`}
                htmlFor={`lang-${i}`}
                className="sr-only"
                error={errors.languages?.[i]?.language?.message}
              >
                <Input
                  id={`lang-${i}`}
                  {...register(`languages.${i}.language`)}
                  placeholder="e.g. Urdu"
                  aria-label={`Language ${i + 1}`}
                  invalid={!!errors.languages?.[i]?.language}
                />
              </FormField>
            </div>
            <div className="flex-1">
              <Select
                {...register(`languages.${i}.proficiency`)}
                aria-label={`Language ${i + 1} proficiency`}
              >
                {PROFICIENCY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)} aria-label={`Remove language ${i + 1}`}>
              ✕
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => append({ language: "", proficiency: "Conversational" })}>
          Add language
        </Button>
        <Button type="submit" size="sm" isLoading={isSubmitting}>Save languages</Button>
      </div>
    </form>
  );
}
