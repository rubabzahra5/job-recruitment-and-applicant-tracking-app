import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  BridgeIllustration,
  ChatBubbleIllustration,
  DocumentCheckIllustration,
  GrowthChartIllustration,
  NoFeeIllustration,
  PakistanMapPin,
  ShieldCheckIllustration,
} from "@/components/ui/Illustrations";
import { JobCard } from "./_components/JobCard";
import {
  EMPLOYMENT_TYPE_LABELS,
  WORKPLACE_LABELS,
  getCategories,
  getLiveJobCounts,
  getLocations,
  getVerifiedOrgs,
  publicClient,
  searchJobs,
} from "./_lib/public-data";

export const metadata: Metadata = {
  title: "Find Jobs in Pakistan",
  description:
    "Browse live job vacancies across Pakistan — Karachi, Lahore, Islamabad, Peshawar and beyond. Apply to verified employers.",
};

const TYPE_TILES = ["full_time", "part_time", "contract", "internship", "remote"] as const;

export default async function HomePage() {
  const db = await publicClient();

  const [counts, categories, locations, verifiedOrgs, latest, fresh] = await Promise.all([
    getLiveJobCounts(db),
    getCategories(db),
    getLocations(db),
    getVerifiedOrgs(db, 6),
    searchJobs(db, { sort: "newest", perPage: 8 }),
    searchJobs(db, { freshOnly: true, sort: "newest", perPage: 4 }),
  ]);

  const orgJobCounts = new Map(counts.byOrg);
  const featuredOrgs = verifiedOrgs.map((o) => ({
    ...o,
    jobCount: orgJobCounts.get(o.id) ?? 0,
  }));

  const popularCities = locations.slice(0, 8);

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0e2a47]">
        {/* gradient wash + dot pattern + bridge motif */}
        <div
          aria-hidden="true"
          className="bg-dots pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60rem 30rem at 85% -10%, rgba(15,98,196,0.35), transparent 60%), radial-gradient(40rem 24rem at -10% 110%, rgba(45,212,191,0.12), transparent 60%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-[1.2fr_1fr] md:py-24">
          <div>
            <p className="reveal inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-sm font-semibold text-teal-300">
              <span className="h-2 w-2 rounded-full bg-teal-400" aria-hidden="true" />
              Pakistan&apos;s employment portal
            </p>
            <h1 className="reveal mt-4 max-w-3xl text-4xl font-extrabold tracking-tight text-white md:text-5xl" style={{ "--d": "80ms" } as React.CSSProperties}>
              Find work that moves Pakistan forward
            </h1>
            <p className="reveal mt-4 max-w-2xl text-lg text-slate-300" style={{ "--d": "160ms" } as React.CSSProperties}>
              Live vacancies from verified employers across the country — search by
              keyword and city, and apply in minutes.
            </p>

          <form
            method="get"
            action="/jobs"
            className="reveal mt-8 flex flex-col gap-3 rounded-xl bg-white p-3 shadow-lg md:flex-row"
            role="search"
            aria-label="Job search"
            style={{ "--d": "240ms" } as React.CSSProperties}
          >
            <label htmlFor="hero-q" className="sr-only">Keyword</label>
            <Input
              id="hero-q"
              name="q"
              placeholder="Job title, skill, or company"
              className="h-12 border-0 text-base shadow-none md:flex-1"
            />
            <label htmlFor="hero-city" className="sr-only">City</label>
            <Select id="hero-city" name="city" defaultValue="" className="h-12 border-0 text-base shadow-none md:w-56">
              <option value="">All cities</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.city}</option>
              ))}
            </Select>
            <button
              type="submit"
              className="h-12 rounded-md bg-teal-600 px-8 text-base font-semibold text-white hover:bg-teal-700"
            >
              Search jobs
            </button>
          </form>

          <div className="reveal mt-5 flex flex-wrap items-center gap-2 text-sm" style={{ "--d": "320ms" } as React.CSSProperties}>
            <span className="text-slate-400">Popular:</span>
            {popularCities.slice(0, 6).map((l) => (
              <Link
                key={l.id}
                href={`/jobs?city=${l.id}`}
                className="rounded-full border border-white/20 px-3 py-1 text-slate-200 transition-colors hover:border-teal-400 hover:text-teal-300"
              >
                {l.city}
              </Link>
            ))}
          </div>
          </div>
          {/* Illustration column */}
          <div className="reveal hidden md:block" style={{ "--d": "240ms" } as React.CSSProperties}>
            <div className="animate-float rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <BridgeIllustration className="h-auto w-full" />
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white/5 px-2 py-3">
                  <p className="text-xl font-extrabold text-teal-300">{counts.total.toLocaleString("en-PK")}</p>
                  <p className="mt-1 text-xs text-slate-400">Live jobs</p>
                </div>
                <div className="rounded-lg bg-white/5 px-2 py-3">
                  <p className="text-xl font-extrabold text-teal-300">{categories.length}</p>
                  <p className="mt-1 text-xs text-slate-400">Categories</p>
                </div>
                <div className="rounded-lg bg-white/5 px-2 py-3">
                  <p className="text-xl font-extrabold text-teal-300">100%</p>
                  <p className="mt-1 text-xs text-slate-400">Free</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live stats (real counts, never hardcoded) ────── */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 md:grid-cols-4">
          {[
            { value: counts.total.toLocaleString("en-PK"), label: "Live vacancies" },
            { value: featuredOrgs.filter((o) => o.jobCount > 0).length.toLocaleString("en-PK"), label: "Verified employers hiring" },
            { value: categories.length.toString(), label: "Job categories" },
            { value: counts.freshGraduate.toLocaleString("en-PK"), label: "Fresh-graduate friendly" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold text-brand-900">{s.value}</p>
              <p className="mt-1 text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why TalentBridge ─────────────────────────────── */}
      <section className="bg-diagonal mx-auto max-w-6xl px-4 py-14">
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
              icon: <ShieldCheckIllustration className="h-16 w-16" />,
              title: "No ghost jobs",
              text: "Employers are scored on responsiveness. Inactive jobs auto-pause. You never apply into a void.",
              link: "/pakistan-first",
              linkText: "How we do it",
            },
            {
              icon: <NoFeeIllustration className="h-16 w-16" />,
              title: "Free means free",
              text: "No commissions, no bidding, no pay-to-apply. Candidates and employers use the core platform free.",
              link: "/why-free",
              linkText: "Why it's free",
            },
            {
              icon: <PakistanMapPin className="h-16 w-16" />,
              title: "Pakistan-first",
              text: "PKR salaries, Karachi-time scheduling, Urdu support, and protections for local work realities.",
              link: "/pakistan-first",
              linkText: "Learn more",
            },
          ].map((f, i) => (
            <div
              key={f.title}
              className="reveal card-lift rounded-xl border border-slate-200 bg-white p-6"
              style={{ "--d": `${i * 100}ms` } as React.CSSProperties}
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-brand-50">
                {f.icon}
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.text}</p>
              <Link href={f.link} className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline">
                {f.linkText} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Categories ───────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Browse by category</h2>
            <p className="mt-1 text-slate-600">Live vacancy counts, updated with every search.</p>
          </div>
          <Link href="/categories" className="text-sm font-semibold text-brand-700 hover:underline">
            All categories →
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.slice(0, 8).map((c, i) => (
            <Link
              key={c.slug}
              href={`/jobs?category=${c.slug}`}
              className="reveal"
              style={{ "--d": `${(i % 4) * 80}ms` } as React.CSSProperties}
            >
              <Card className="card-lift h-full p-5">
                <p className="text-2xl" aria-hidden="true">{c.icon ?? "💼"}</p>
                <p className="mt-2 font-semibold text-slate-900">{c.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {(counts.byCategory.get(c.id) ?? 0).toLocaleString("en-PK")} open roles
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Latest jobs ──────────────────────────────────── */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Latest vacancies</h2>
              <p className="mt-1 text-slate-600">Fresh postings from verified employers.</p>
            </div>
            <Link href="/jobs?sort=newest" className="text-sm font-semibold text-brand-700 hover:underline">
              All jobs →
            </Link>
          </div>
          {latest.jobs.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {latest.jobs.map((j) => (
                <JobCard key={j.id} job={j} />
              ))}
            </div>
          ) : (
            <p className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
              No live vacancies right now — check back soon or{" "}
              <Link href="/register" className="font-semibold text-brand-700 hover:underline">
                create a free account
              </Link>{" "}
              to get job alerts.
            </p>
          )}
        </div>
      </section>

      {/* ── Employment types ─────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Work the way you want</h2>
        <p className="mt-1 text-slate-600">Live openings by employment type and workplace.</p>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {TYPE_TILES.map((t) => {
            const count =
              t === "remote"
                ? (counts.byWorkplace.get("remote") ?? 0)
                : (counts.byEmploymentType.get(t) ?? 0);
            const href =
              t === "remote" ? "/jobs?workplace=remote" : `/jobs?type=${t}`;
            return (
              <Link key={t} href={href}>
                <Card className="h-full p-5 text-center transition-shadow hover:shadow-md">
                  <p className="text-2xl font-extrabold text-brand-900">{count.toLocaleString("en-PK")}</p>
                  <p className="mt-1 text-sm font-medium text-slate-600">
                    {t === "remote" ? WORKPLACE_LABELS.remote : EMPLOYMENT_TYPE_LABELS[t]} jobs
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Fresh graduates ──────────────────────────────── */}
      <section className="bg-teal-50/60">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Fresh graduates welcome</h2>
              <p className="mt-1 text-slate-600">
                Employers explicitly open to candidates starting their careers.
              </p>
            </div>
            <Link href="/jobs?fresh=1" className="text-sm font-semibold text-brand-700 hover:underline">
              View all →
            </Link>
          </div>
          {fresh.jobs.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {fresh.jobs.map((j) => (
                <JobCard key={j.id} job={j} />
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

      {/* ── Featured employers ───────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Featured employers</h2>
            <p className="mt-1 text-slate-600">Verified organizations hiring now.</p>
          </div>
          <Link href="/companies" className="text-sm font-semibold text-brand-700 hover:underline">
            All companies →
          </Link>
        </div>
        {featuredOrgs.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredOrgs.map((o) => (
              <Link key={o.slug} href={`/companies/${o.slug}`}>
                <Card className="flex h-full items-center gap-4 p-5 transition-shadow hover:shadow-md">
                  {o.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.logo_url} alt={`${o.name} logo`} className="h-12 w-12 rounded-md border border-slate-200 object-contain" />
                  ) : (
                    <div aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-md bg-brand-900 text-xl font-bold text-white">
                      {o.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{o.name}</p>
                    <p className="text-sm text-slate-500">
                      {o.industry ?? "Employer"} · {o.jobCount} open role{o.jobCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-slate-500">Employer profiles are on their way.</p>
        )}
      </section>

      {/* ── CTAs ─────────────────────────────────────────── */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-2">
          <div className="reveal relative overflow-hidden rounded-2xl bg-[#0e2a47] p-8 text-white">
            <div aria-hidden="true" className="bg-dots pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative">
              <GrowthChartIllustration className="h-14 w-14" />
              <h2 className="mt-4 text-xl font-bold">Hiring for your organization?</h2>
              <p className="mt-2 text-slate-300">
                Post vacancies, track applicants through a structured pipeline, and
                hire faster — free to get started.
              </p>
              <Link
                href="/register?type=employer"
                className="mt-5 inline-block rounded-md bg-teal-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-teal-500"
              >
                Post a job
              </Link>
            </div>
          </div>
          <div className="reveal card-lift rounded-2xl border border-slate-200 bg-slate-50 p-8" style={{ "--d": "120ms" } as React.CSSProperties}>
            <DocumentCheckIllustration className="h-14 w-14" />
            <h2 className="mt-4 text-xl font-bold text-slate-900">Never miss the right role</h2>
            <p className="mt-2 text-slate-600">
              Create a free candidate account to save jobs and get alerts when
              matching vacancies go live.
            </p>
            <Link
              href="/register?type=candidate"
              className="mt-5 inline-block rounded-md bg-brand-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Create free account
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
