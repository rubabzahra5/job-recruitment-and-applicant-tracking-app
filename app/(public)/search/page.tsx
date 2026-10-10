import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { JobCard } from "../_components/JobCard";
import {
  getCategories,
  getLocations,
  publicClient,
  searchJobs,
} from "../_lib/public-data";

export const metadata: Metadata = {
  title: "Search Jobs",
  description: "Search all live job vacancies across Pakistan in one place.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Unified search entry. Reuses the same server-side search logic as /jobs;
 * submitting here shows top matches inline, with a link to the full catalog.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = (first(sp.q) ?? "").trim().slice(0, 200);
  const cityId = first(sp.city) ?? "";
  const categorySlug = first(sp.category) ?? "";

  const db = await publicClient();
  const [categories, locations] = await Promise.all([getCategories(db), getLocations(db)]);

  const result = q || cityId || categorySlug
    ? await searchJobs(db, {
        q: q || undefined,
        cityId: cityId || undefined,
        categorySlug: categorySlug || undefined,
        sort: "relevance",
        perPage: 10,
      })
    : null;

  const fullHref = `/jobs?${new URLSearchParams(
    Object.entries({ q, city: cityId, category: categorySlug }).filter(([, v]) => v),
  ).toString()}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Search jobs</h1>
      <p className="mt-1 text-slate-600">
        One search across every live vacancy on HirePakistan.
      </p>

      <Card className="mt-6 p-5">
        <form method="get" action="/search" role="search" aria-label="Unified job search" className="grid gap-3 md:grid-cols-[1fr_220px_220px_auto]">
          <div>
            <label htmlFor="s-q" className="sr-only">Keyword</label>
            <Input id="s-q" name="q" defaultValue={q} placeholder="Job title, skill, or company" />
          </div>
          <div>
            <label htmlFor="s-city" className="sr-only">City</label>
            <Select id="s-city" name="city" defaultValue={cityId}>
              <option value="">All cities</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.city}</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="s-category" className="sr-only">Category</label>
            <Select id="s-category" name="category" defaultValue={categorySlug}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </Select>
          </div>
          <button
            type="submit"
            className="h-10 rounded-md bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Search
          </button>
        </form>
      </Card>

      {result && (
        <section className="mt-8" aria-label="Search results">
          <div className="flex items-end justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              {result.total === 0
                ? "No matches"
                : `Top matches (${result.total.toLocaleString("en-PK")} total)`}
            </h2>
            {result.total > 0 && (
              <Link href={fullHref} className="text-sm font-semibold text-brand-700 hover:underline">
                View all in job search →
              </Link>
            )}
          </div>
          {result.jobs.length > 0 ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {result.jobs.map((j) => (
                <JobCard key={j.id} job={j} />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              Nothing matched. Try different keywords, or{" "}
              <Link href="/jobs" className="font-semibold text-brand-700 hover:underline">
                browse all jobs with filters
              </Link>
              .
            </p>
          )}
        </section>
      )}

      {!result && (
        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-bold text-slate-900">Popular categories</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.slice(0, 8).map((c) => (
                <Link
                  key={c.slug}
                  href={`/search?category=${c.slug}`}
                  className="rounded-full border border-slate-300 px-3 py-1 text-sm hover:border-brand-600 hover:text-brand-700"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="font-bold text-slate-900">Popular cities</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {locations.slice(0, 8).map((l) => (
                <Link
                  key={l.id}
                  href={`/search?city=${l.id}`}
                  className="rounded-full border border-slate-300 px-3 py-1 text-sm hover:border-brand-600 hover:text-brand-700"
                >
                  {l.city}
                </Link>
              ))}
            </div>
          </Card>
        </section>
      )}
    </main>
  );
}
