import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";
import { JobCard } from "../_components/JobCard";
import { JobFilters, type JobFilterValues } from "../_components/JobFilters";
import { Pager } from "../_components/Pager";
import { SortSelect } from "../_components/SortSelect";
import {
  EMPLOYMENT_TYPES,
  getCategories,
  getLocations,
  publicClient,
  searchJobs,
  type JobSearchFilters,
} from "../_lib/public-data";
import { formatResponseBadge, getOrgsResponsiveness } from "@/lib/responsiveness";

export const metadata: Metadata = {
  title: "Browse Jobs",
  description: "Search live job vacancies across Pakistan with filters for city, category, salary, and more.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Parse + whitelist URL params into a safe JobSearchFilters object. */
function parseFilters(sp: SearchParams): { filters: JobSearchFilters; values: JobFilterValues; params: Record<string, string> } {
  const values: JobFilterValues = {};
  const params: Record<string, string> = {};
  const filters: JobSearchFilters = {};

  const take = (key: keyof JobFilterValues, map?: (v: string) => void) => {
    const v = first(sp[key]);
    if (v !== undefined && v !== "") {
      values[key] = v;
      params[key] = v;
      map?.(v);
    }
  };

  take("q", (v) => { filters.q = v.slice(0, 200); });
  take("company", (v) => { filters.company = v.slice(0, 200); });
  take("city", (v) => { filters.cityId = v; });
  take("province", (v) => { filters.province = v; });
  take("category", (v) => { filters.categorySlug = v; });
  take("type", (v) => { if (EMPLOYMENT_TYPES.includes(v)) filters.employmentType = v; else delete values.type; });
  take("level", (v) => {
    if (v === "entry" || v === "mid" || v === "senior") filters.experienceLevel = v;
    else delete values.level;
  });
  take("edu", (v) => { filters.education = v.slice(0, 100); });
  take("min_salary", (v) => {
    const n = Number(v.replace(/[^0-9]/g, ""));
    if (Number.isFinite(n) && n > 0) filters.minSalary = n;
    else { delete values.min_salary; delete params.min_salary; }
  });
  take("workplace", (v) => {
    if (["on_site", "hybrid", "remote"].includes(v)) filters.workplace = v;
    else delete values.workplace;
  });
  take("fresh", (v) => { filters.freshOnly = v === "1"; });
  take("posted", (v) => {
    const n = Number(v);
    if ([1, 3, 7, 14, 30].includes(n)) filters.postedWithinDays = n;
    else { delete values.posted; delete params.posted; }
  });
  take("sort", (v) => {
    if (["relevance", "newest", "deadline", "salary"].includes(v)) {
      filters.sort = v as JobSearchFilters["sort"];
    } else { delete values.sort; delete params.sort; }
  });

  const page = Number(first(sp.page));
  if (Number.isInteger(page) && page > 1) {
    filters.page = page;
    params.page = String(page);
  }
  const perPage = Number(first(sp.per_page));
  if (Number.isInteger(perPage) && perPage >= 5 && perPage <= 50) {
    filters.perPage = perPage;
    params.per_page = String(perPage);
  }

  return { filters, values, params };
}

export default async function JobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { filters, values, params } = parseFilters(sp);
  const db = await publicClient();

  const [result, categories, locations] = await Promise.all([
    searchJobs(db, filters),
    getCategories(db),
    getLocations(db),
  ]);

  // Ghost-job accountability: fetch employer response rates for visible jobs.
  const orgIds = [...new Set(result.jobs.map((j) => j.org?.id).filter(Boolean) as string[])];
  const responsiveness = await getOrgsResponsiveness(orgIds);
  const badgeFor = (orgId: string | undefined) => {
    if (!orgId) return null;
    const r = responsiveness.get(orgId);
    return r ? formatResponseBadge(r) : null;
  };

  const activeFilterCount = Object.keys(values).filter(
    (k) => !["q", "sort", "page", "per_page"].includes(k) && values[k as keyof JobFilterValues],
  ).length;

  const sortParams = { ...params };
  delete sortParams.sort;
  delete sortParams.page;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Browse jobs</h1>
      <p className="mt-1 text-slate-600" role="status">
        {result.total === 0
          ? "No vacancies match your search."
          : `${result.total.toLocaleString("en-PK")} live ${result.total === 1 ? "vacancy" : "vacancies"}`}
        {activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} applied`}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside aria-label="Job filters">
          <div className="lg:sticky lg:top-24">
            <details className="lg:hidden" open={activeFilterCount > 0}>
              <summary className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700">
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </summary>
              <div className="mt-3">
                <JobFilters categories={categories} locations={locations} values={values} />
              </div>
            </details>
            <div className="hidden lg:block">
              <JobFilters categories={categories} locations={locations} values={values} />
            </div>
          </div>
        </aside>

        <section aria-label="Job results">
          <div className="mb-4 flex items-center justify-end gap-2">
            <SortSelect
              current={values.sort ?? (values.q ? "relevance" : "newest")}
              preserved={sortParams}
            />
          </div>

          {result.jobs.length > 0 ? (
            <>
              <div className="grid gap-4">
                {result.jobs.map((j) => (
                  <JobCard key={j.id} job={j} responseBadge={badgeFor(j.org?.id)} />
                ))}
              </div>
              <div className="mt-8">
                <Pager page={result.page} totalPages={result.totalPages} basePath="/jobs" params={params} />
              </div>
              <p className="mt-3 text-center text-sm text-slate-500">
                Page {result.page} of {result.totalPages}
              </p>
            </>
          ) : (
            <EmptyState
              title="No jobs found"
              description="Try broadening your keywords, removing a filter, or exploring a different city or category."
              action={
                <Link
                  href="/jobs"
                  className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Clear all filters
                </Link>
              }
            />
          )}
        </section>
      </div>
    </main>
  );
}
