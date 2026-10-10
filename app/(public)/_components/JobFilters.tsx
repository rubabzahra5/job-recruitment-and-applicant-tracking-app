import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  EDUCATION_OPTIONS,
  EMPLOYMENT_TYPE_LABELS,
  EMPLOYMENT_TYPES,
  POSTED_WITHIN_OPTIONS,
  PROVINCES,
  WORKPLACE_LABELS,
  type PublicCategory,
  type PublicLocation,
} from "../_lib/public-data";

export interface JobFilterValues {
  q?: string;
  company?: string;
  city?: string;
  province?: string;
  category?: string;
  type?: string;
  level?: string;
  edu?: string;
  min_salary?: string;
  workplace?: string;
  fresh?: string;
  posted?: string;
  sort?: string;
}

/**
 * Server-rendered filter form (GET). Every control submits into the URL, so
 * filtered views are shareable and everything runs server-side.
 */
export function JobFilters({
  categories,
  locations,
  values,
}: {
  categories: PublicCategory[];
  locations: PublicLocation[];
  values: JobFilterValues;
}) {
  const field = "mb-3";
  const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

  return (
    <form method="get" action="/jobs" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className={field}>
        <label htmlFor="f-q" className={label}>Keyword</label>
        <Input id="f-q" name="q" defaultValue={values.q ?? ""} placeholder="Job title, skill…" />
      </div>

      <div className={field}>
        <label htmlFor="f-company" className={label}>Company</label>
        <Input id="f-company" name="company" defaultValue={values.company ?? ""} placeholder="Employer name" />
      </div>

      <div className={field}>
        <label htmlFor="f-city" className={label}>City</label>
        <Select id="f-city" name="city" defaultValue={values.city ?? ""}>
          <option value="">All cities</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.city}
            </option>
          ))}
        </Select>
      </div>

      <div className={field}>
        <label htmlFor="f-province" className={label}>Province / Territory</label>
        <Select id="f-province" name="province" defaultValue={values.province ?? ""}>
          <option value="">All provinces</option>
          {PROVINCES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </Select>
      </div>

      <div className={field}>
        <label htmlFor="f-category" className={label}>Category</label>
        <Select id="f-category" name="category" defaultValue={values.category ?? ""}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </Select>
      </div>

      <div className={field}>
        <label htmlFor="f-type" className={label}>Employment type</label>
        <Select id="f-type" name="type" defaultValue={values.type ?? ""}>
          <option value="">All types</option>
          {EMPLOYMENT_TYPES.map((t) => (
            <option key={t} value={t}>{EMPLOYMENT_TYPE_LABELS[t]}</option>
          ))}
        </Select>
      </div>

      <div className={field}>
        <label htmlFor="f-workplace" className={label}>Workplace</label>
        <Select id="f-workplace" name="workplace" defaultValue={values.workplace ?? ""}>
          <option value="">Any</option>
          {Object.entries(WORKPLACE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      </div>

      <div className={field}>
        <label htmlFor="f-level" className={label}>Experience level</label>
        <Select id="f-level" name="level" defaultValue={values.level ?? ""}>
          <option value="">Any</option>
          <option value="entry">Entry level (0–1 yrs)</option>
          <option value="mid">Mid level (2–5 yrs)</option>
          <option value="senior">Senior (6+ yrs)</option>
        </Select>
      </div>

      <div className={field}>
        <label htmlFor="f-edu" className={label}>Education</label>
        <Select id="f-edu" name="edu" defaultValue={values.edu ?? ""}>
          <option value="">Any</option>
          {EDUCATION_OPTIONS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </Select>
      </div>

      <div className={field}>
        <label htmlFor="f-min-salary" className={label}>Minimum salary (PKR/month)</label>
        <Input
          id="f-min-salary"
          name="min_salary"
          inputMode="numeric"
          defaultValue={values.min_salary ?? ""}
          placeholder="e.g. 80000"
        />
      </div>

      <div className={field}>
        <label htmlFor="f-posted" className={label}>Date posted</label>
        <Select id="f-posted" name="posted" defaultValue={values.posted ?? ""}>
          <option value="">Any time</option>
          {POSTED_WITHIN_OPTIONS.map((o) => (
            <option key={o.value} value={String(o.value)}>{o.label}</option>
          ))}
        </Select>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <input
          id="f-fresh"
          name="fresh"
          type="checkbox"
          value="1"
          defaultChecked={values.fresh === "1"}
          className="h-4 w-4 rounded border-slate-300 accent-brand-600"
        />
        <label htmlFor="f-fresh" className="text-sm font-medium text-slate-700">
          Fresh graduates only
        </label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" className="flex-1">Apply filters</Button>
        <Link
          href="/jobs"
          className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          Clear
        </Link>
      </div>
    </form>
  );
}
