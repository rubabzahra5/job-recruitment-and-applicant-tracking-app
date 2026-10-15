import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Banknote, MapPin, Search, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { CompanyCard } from "@/components/ui/CompanyCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { JobCard, type JobCardData } from "@/components/ui/JobCard";
import { Select } from "@/components/ui/Select";
import { BridgeDivider, WaveDivider } from "@/components/ui/dividers";
import {
  ApplyIllustration,
  CreateProfileIllustration,
  GetHiredIllustration,
} from "@/components/ui/HowItWorks";
import { CountUp } from "./_components/CountUp";
import { ScrollVideo } from "./_components/ScrollVideo";
import { categoryIcon } from "./_components/category-icons";
import {
  getCategories,
  getLiveJobCounts,
  getLocations,
  getVerifiedOrgs,
  publicClient,
  searchJobs,
  type PublicJob,
} from "./_lib/public-data";
import { getOrgResponsiveness } from "@/lib/responsiveness";
import { formatSalaryRange, timeAgo } from "@/lib/format";

export const metadata: Metadata = {
  title: "Find Jobs in Pakistan",
  description:
    "Browse live job vacancies across Pakistan — Karachi, Lahore, Islamabad, Peshawar and beyond. Apply to verified employers.",
};

function toJobCard(job: PublicJob, responseRates: Map<string, number | null>): JobCardData {
  const locationLabel =
    job.workplace === "remote"
      ? "Remote"
      : job.location
        ? job.location.city
        : undefined;
  const tags: string[] = [];
  if (job.employment_type) tags.push(job.employment_type.replace(/_/g, " "));
  if (job.category) tags.push(job.category.name);
  if (job.is_fresh_graduate_ok) tags.push("Fresh graduates");
  return {
    id: job.id,
    title: job.title,
    companyName: job.org?.name ?? "Employer",
    companyLogoUrl: job.org?.logo_url ?? null,
    verified: job.org?.verification_status === "verified",
    city: locationLabel,
    salaryMin: job.salary_disclosed ? job.salary_min : null,
    salaryMax: job.salary_disclosed ? job.salary_max : null,
    tags: tags.slice(0, 3),
    postedAgo: `${timeAgo(job.published_at ?? job.created_at)} ago`,
    responseRate: job.org ? (responseRates.get(job.org.id) ?? null) : null,
    href: `/jobs/${job.slug}`,
  };
}

export default async function HomePage() {
  const db = await publicClient();

  const [counts, categories, locations, verifiedOrgs, latest, fresh] = await Promise.all([
    getLiveJobCounts(db),
    getCategories(db),
    getLocations(db),
    getVerifiedOrgs(db, 6),
    searchJobs(db, { sort: "newest", perPage: 6 }),
    searchJobs(db, { freshOnly: true, sort: "newest", perPage: 4 }),
  ]);

  // Cities with live openings, sorted by count desc — zero-count cities hidden.
  const citiesWithJobs = locations
    .map((l) => ({ ...l, count: counts.byLocation.get(l.id) ?? 0 }))
    .filter((l) => l.count > 0)
    .sort((a, b) => b.count - a.count);

  // Categories with live openings, sorted by count desc.
  const liveCategories = categories
    .map((c) => ({ ...c, count: counts.byCategory.get(c.id) ?? 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const orgJobCounts = new Map(counts.byOrg);
  const featuredOrgs = verifiedOrgs.map((o) => ({
    ...o,
    jobCount: orgJobCounts.get(o.id) ?? 0,
  }));

  // Employer response rates for the ghost-job trust signal (batched).
  const orgIds = [...new Set([...latest.jobs, ...fresh.jobs].map((j) => j.org?.id).filter(Boolean) as string[])].slice(0, 12);
  const respResults = await Promise.all(orgIds.map((id) => getOrgResponsiveness(id).catch(() => null)));
  const responseRates = new Map<string, number | null>();
  for (const r of respResults) {
    if (r && r.responseRate !== null && r.totalApplications >= 5) {
      responseRates.set(r.orgId, r.responseRate);
    }
  }

  const hiringOrgCount = featuredOrgs.filter((o) => o.jobCount > 0).length;

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0e2a47]">
        <div aria-hidden="true" className="blob-blue pointer-events-none absolute -top-32 end-[-8rem] h-[28rem] w-[28rem]" />
        <div aria-hidden="true" className="blob-teal pointer-events-none absolute -bottom-40 start-[-6rem] h-[26rem] w-[26rem]" />
        <div aria-hidden="true" className="bg-dots pointer-events-none absolute inset-0 opacity-70" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[1.15fr_1fr] md:py-20">
          <div>
            <p className="reveal inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-sm font-semibold text-teal-300">
              <span className="h-2 w-2 rounded-full bg-teal-400" aria-hidden="true" />
              Pakistan&apos;s employment portal
            </p>
            <h1
              className="reveal mt-4 max-w-xl text-4xl font-extrabold tracking-tight text-white md:text-5xl"
              style={{ "--d": "80ms" } as React.CSSProperties}
            >
              Find work that moves Pakistan forward
            </h1>
            <p
              className="reveal mt-4 max-w-xl text-lg text-slate-300"
              style={{ "--d": "160ms" } as React.CSSProperties}
            >
              Live vacancies from verified employers across the country.
              No ghost jobs, no fees — ever.
            </p>

            {/* Search — one primary action, labeled fields */}
            <form
              method="get"
              action="/jobs"
              role="search"
              aria-label="Job search"
              className="reveal mt-8 rounded-2xl bg-white p-4 shadow-2xl md:p-5"
              style={{ "--d": "240ms" } as React.CSSProperties}
            >
              <div className="grid gap-4 md:grid-cols-[1.4fr_1fr_1fr]">
                <FormField label="Keyword" htmlFor="hero-q">
                  <Input id="hero-q" name="q" placeholder="e.g. Accountant" className="h-11" />
                </FormField>
                <FormField label="City" htmlFor="hero-city">
                  <Select id="hero-city" name="city" defaultValue="" className="h-11">
                    <option value="">All cities</option>
                    {citiesWithJobs.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.city} ({l.count})
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Category" htmlFor="hero-cat">
                  <Select id="hero-cat" name="category" defaultValue="" className="h-11">
                    <option value="">All categories</option>
                    {liveCategories.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <button
                type="submit"
                className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-10 text-base font-semibold text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 md:w-auto"
              >
                <Search className="h-5 w-5" aria-hidden="true" />
                Search jobs
              </button>
            </form>

            {/* City chips — sorted by openings, counts shown, zero-count hidden */}
            {citiesWithJobs.length > 0 && (
              <div
                className="reveal mt-5 flex flex-wrap items-center gap-2"
                style={{ "--d": "320ms" } as React.CSSProperties}
              >
                <span className="text-sm text-slate-400">Popular:</span>
                {citiesWithJobs.slice(0, 6).map((l) => (
                  <Link
                    key={l.id}
                    href={`/jobs?city=${l.id}`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/20 px-3 py-1 text-sm text-slate-200 transition-colors hover:border-teal-400 hover:text-teal-300"
                  >
                    {l.city}
                    <span className="rounded-full bg-white/10 px-1.5 text-xs tabular-nums">{l.count}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Floating 3D bridge video + glass job previews */}
          <div className="reveal relative hidden md:block" style={{ "--d": "200ms" } as React.CSSProperties}>
            <div className="animate-float">
              <ScrollVideo
                src="/videos/hero-bridge.mp4"
                poster="/images/hero-bridge-3d.webp"
                label="Animated 3D glass bridge"
              />
              <div className="mt-4 space-y-2">
                {latest.jobs.slice(0, 2).map((j) => (
                  <Link
                    key={j.id}
                    href={`/jobs/${j.slug}`}
                    className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm transition-colors hover:border-teal-400/40"
                  >
                    <p className="truncate text-sm font-semibold text-white">{j.title}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-300">
                      <span className="truncate">{j.org?.name ?? "Employer"}</span>
                      {j.salary_disclosed && (
                        <span className="shrink-0 font-semibold text-teal-300 tabular-nums">
                          {formatSalaryRange(j.salary_min, j.salary_max, j.salary_period)}
                        </span>
                      )}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
        <BridgeDivider className="relative text-teal-300/60" />
      </section>

      {/* ── Trust strip — each number shown ONCE ─────────── */}
      <section aria-label="Platform statistics" className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 md:grid-cols-4">
          {[
            { value: counts.total, label: "Live vacancies" },
            { value: hiringOrgCount, label: "Verified employers hiring" },
            { value: counts.freshGraduate, label: "Fresh-graduate roles" },
            { value: citiesWithJobs.length, label: "Cities with openings" },
          ].map((s, i) => (
            <div
              key={s.label}
              className="reveal text-center"
              style={{ "--d": `${i * 80}ms` } as React.CSSProperties}
            >
              <p className="text-3xl font-extrabold text-brand-900 md:text-4xl">
                <CountUp to={s.value} />
              </p>
              <p className="mt-1 text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why TalentBridge ─────────────────────────────── */}
      <section className="pattern-islamic">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="reveal text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Built different, <span className="text-gradient">on purpose</span>
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-slate-600">
              We fixed the things that make job hunting miserable — ghost jobs, hidden fees, and one-size-fits-all platforms.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                tone: "emerald" as const,
                title: "No ghost jobs",
                text: "Employers are scored on responsiveness. Inactive jobs auto-pause. You never apply into a void.",
                link: "/pakistan-first",
                linkText: "How we do it",
              },
              {
                icon: Banknote,
                tone: "teal" as const,
                title: "Free means free",
                text: "No commissions, no bidding, no pay-to-apply. Candidates and employers use the core platform free.",
                link: "/why-free",
                linkText: "Why it's free",
              },
              {
                icon: MapPin,
                tone: "blue" as const,
                title: "Pakistan-first",
                text: "PKR salaries, Karachi-time scheduling, and protections built for local work realities.",
                link: "/pakistan-first",
                linkText: "Learn more",
              },
            ].map((f, i) => (
              <div
                key={f.title}
                className="reveal card-lift rounded-2xl border border-slate-200 bg-white p-6"
                style={{ "--d": `${i * 100}ms` } as React.CSSProperties}
              >
                <IconTile icon={f.icon} tone={f.tone} size="md" />
                <h3 className="mt-4 text-lg font-bold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.text}</p>
                <Link
                  href={f.link}
                  className="mt-4 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
                >
                  {f.linkText} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WaveDivider className="bg-white text-slate-50" />

      {/* ── Categories ───────────────────────────────────── */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Browse by category</h2>
              <p className="mt-1 text-slate-600">Live vacancy counts — empty categories are hidden.</p>
            </div>
            <Link
              href="/categories"
              className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
            >
              All categories <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          {liveCategories.length > 0 ? (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {liveCategories.map((c, i) => {
                const Icon = categoryIcon(c.slug);
                return (
                  <Link
                    key={c.slug}
                    href={`/jobs?category=${c.slug}`}
                    className="reveal card-lift rounded-2xl border border-slate-200 bg-white p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    style={{ "--d": `${(i % 4) * 80}ms` } as React.CSSProperties}
                  >
                    <IconTile icon={Icon} tone="blue" size="md" />
                    <p className="mt-3 font-semibold text-slate-900">{c.name}</p>
                    <p className="mt-1 text-sm text-slate-500 tabular-nums">
                      {c.count.toLocaleString("en-PK")} open role{c.count === 1 ? "" : "s"}
                    </p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No categories with live roles yet"
              description="Check back soon — new vacancies are added daily."
            />
          )}
        </div>
      </section>

      {/* ── Latest jobs ──────────────────────────────────── */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Latest vacancies</h2>
              <p className="mt-1 text-slate-600">Fresh postings from verified employers.</p>
            </div>
            <Link
              href="/jobs?sort=newest"
              className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
            >
              All jobs <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          {latest.jobs.length > 0 ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {latest.jobs.map((j, i) => (
                <div key={j.id} className="reveal" style={{ "--d": `${(i % 2) * 100}ms` } as React.CSSProperties}>
                  <JobCard job={toJobCard(j, responseRates)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState
                title="No live vacancies right now"
                description="Check back soon, or create a free account to get job alerts."
                action={
                  <Link href="/register">
                    <Button size="sm">Create free account</Button>
                  </Link>
                }
              />
            </div>
          )}
        </div>
      </section>

      <BridgeDivider className="bg-white text-brand-600" flip />

      {/* ── Fresh graduates ──────────────────────────────── */}
      <section className="bg-teal-50/60">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Fresh graduates welcome</h2>
              <p className="mt-1 text-slate-600">
                Employers explicitly open to candidates starting their careers.
              </p>
            </div>
            <Link
              href="/jobs?fresh=1"
              className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
            >
              View all <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          {fresh.jobs.length > 0 ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {fresh.jobs.map((j) => (
                <JobCard key={j.id} job={toJobCard(j, responseRates)} />
              ))}
            </div>
          ) : (
            <p className="mt-6 text-slate-500">
              No fresh-graduate roles live right now —{" "}
              <Link href="/jobs" className="font-semibold text-brand-700 hover:underline">
                browse all vacancies
              </Link>
              .
            </p>
          )}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="reveal text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Get hired in three steps
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-slate-600">
              No fees, no black holes — just a straight path from profile to paycheck.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { C: CreateProfileIllustration, step: "1", title: "Create your profile", text: "Upload your CV — we pre-fill your profile in seconds." },
              { C: ApplyIllustration, step: "2", title: "Apply in minutes", text: "One profile, one click. Track every application live." },
              { C: GetHiredIllustration, step: "3", title: "Get hired", text: "Interviews, offers, and onboarding — all in one place." },
            ].map(({ C, step, title, text }, i) => (
              <div
                key={step}
                className="reveal card-lift rounded-2xl border border-slate-200 bg-white p-6 text-center"
                style={{ "--d": `${i * 100}ms` } as React.CSSProperties}
              >
                <C className="mx-auto h-28 w-28" />
                <p className="mt-3 text-xs font-bold uppercase tracking-widest text-brand-600">Step {step}</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WaveDivider className="bg-white text-slate-50" />

      {/* ── Featured employers ───────────────────────────── */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Featured employers</h2>
              <p className="mt-1 text-slate-600">Verified organizations hiring now.</p>
            </div>
            <Link
              href="/companies"
              className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
            >
              All companies <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          {featuredOrgs.length > 0 ? (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredOrgs.map((o, i) => (
                <div key={o.slug} className="reveal" style={{ "--d": `${(i % 3) * 80}ms` } as React.CSSProperties}>
                  <CompanyCard
                    company={{
                      slug: o.slug,
                      name: o.name,
                      logoUrl: o.logo_url,
                      industry: o.industry,
                      openRoles: o.jobCount,
                      verified: o.verification_status === "verified",
                      href: `/companies/${o.slug}`,
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-slate-500">Employer profiles are on their way.</p>
          )}
        </div>
      </section>

      {/* ── CTAs ─────────────────────────────────────────── */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-2">
          <div className="reveal relative overflow-hidden rounded-2xl bg-[#0e2a47] p-8 text-white">
            <div aria-hidden="true" className="blob-teal pointer-events-none absolute -top-16 -end-16 h-64 w-64" />
            <div aria-hidden="true" className="bg-dots pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative">
              <IconTile icon={Banknote} tone="teal" size="md" />
              <h2 className="mt-4 text-xl font-bold">Hiring for your organization?</h2>
              <p className="mt-2 text-slate-300">
                Post vacancies, track applicants through a structured pipeline, and
                hire faster — free to get started.
              </p>
              <Link
                href="/register?type=employer"
                className="mt-5 inline-flex min-h-[44px] items-center rounded-lg bg-teal-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
              >
                Post a job
              </Link>
            </div>
          </div>
          <div
            className="reveal card-lift rounded-2xl border border-slate-200 bg-slate-50 p-8"
            style={{ "--d": "120ms" } as React.CSSProperties}
          >
            <IconTile icon={ShieldCheck} tone="blue" size="md" />
            <h2 className="mt-4 text-xl font-bold text-slate-900">Never miss the right role</h2>
            <p className="mt-2 text-slate-600">
              Create a free candidate account to save jobs and get alerts when
              matching vacancies go live.
            </p>
            <Link
              href="/register?type=candidate"
              className="mt-5 inline-flex min-h-[44px] items-center rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              Create free account
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
