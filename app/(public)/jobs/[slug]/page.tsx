import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getSessionUser } from "@/lib/auth";
import { formatDateOnlyKarachi, formatSalaryRange } from "@/lib/format";
import { JobCard } from "../../_components/JobCard";
import {
  EMPLOYMENT_TYPE_LABELS,
  WORKPLACE_LABELS,
  getJobQuestions,
  getLiveJobBySlug,
  publicClient,
  searchJobs,
  type PublicJob,
} from "../../_lib/public-data";

type Params = { slug: string };

function experienceLabel(job: PublicJob): string {
  const { experience_min_years: min, experience_max_years: max } = job;
  if (min === null && max === null) {
    return job.is_fresh_graduate_ok ? "Fresh graduates welcome" : "Not specified";
  }
  if (min !== null && max !== null) return `${min}–${max} years`;
  if (min !== null) return `${min}+ years`;
  return `Up to ${max} years`;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const db = await publicClient();
  const job = await getLiveJobBySlug(db, slug);
  if (!job) return { title: "Job not found" };
  const where = job.location ? `${job.location.city}` : "Pakistan";
  return {
    title: `${job.title} at ${job.org?.name ?? "Employer"} — ${where}`,
    description: job.description.slice(0, 160),
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <div className="mt-3 text-slate-700">{children}</div>
    </section>
  );
}

export default async function JobDetailPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const db = await publicClient();
  const job = await getLiveJobBySlug(db, slug);
  // 404 for drafts, expired, closed, or suspended-org vacancies.
  if (!job) notFound();

  const [questions, similar, user] = await Promise.all([
    getJobQuestions(db, job.id),
    searchJobs(db, {
      categorySlug: job.category?.slug,
      perPage: 5,
      sort: "newest",
    }),
    getSessionUser(),
  ]);
  const similarJobs = similar.jobs.filter((j) => j.id !== job.id).slice(0, 4);

  const locationLabel =
    job.workplace === "remote"
      ? "Remote (Pakistan)"
      : job.location
        ? `${job.location.city}, ${job.location.province}`
        : "Pakistan";

  const applyHref = user ? "/candidate" : `/login?next=${encodeURIComponent(`/jobs/${job.slug}`)}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href="/jobs" className="hover:text-brand-700 hover:underline">Jobs</Link>
        <span aria-hidden="true" className="mx-2">/</span>
        {job.category && (
          <>
            <Link href={`/jobs?category=${job.category.slug}`} className="hover:text-brand-700 hover:underline">
              {job.category.name}
            </Link>
            <span aria-hidden="true" className="mx-2">/</span>
          </>
        )}
        <span aria-current="page" className="text-slate-700">{job.title}</span>
      </nav>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <article>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
                    {job.title}
                  </h1>
                  <p className="mt-2 text-slate-600">
                    {job.org ? (
                      <Link href={`/companies/${job.org.slug}`} className="font-semibold text-brand-700 hover:underline">
                        {job.org.name}
                      </Link>
                    ) : "Employer"}
                    <span aria-hidden="true" className="mx-2 text-slate-300">·</span>
                    {locationLabel}
                  </p>
                </div>
                {job.org?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={job.org.logo_url} alt={`${job.org.name} logo`} className="h-14 w-14 rounded-md border border-slate-200 object-contain" />
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="info">{EMPLOYMENT_TYPE_LABELS[job.employment_type] ?? job.employment_type}</Badge>
                <Badge tone="neutral">{WORKPLACE_LABELS[job.workplace] ?? job.workplace}</Badge>
                {job.is_fresh_graduate_ok && <Badge tone="success">Fresh graduates welcome</Badge>}
                {job.deadline && (
                  <Badge tone="warning">
                    Apply by {formatDateOnlyKarachi(job.deadline)}
                  </Badge>
                )}
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-sm md:grid-cols-3">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Salary</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {job.salary_disclosed
                      ? formatSalaryRange(job.salary_min, job.salary_max, job.salary_period)
                      : "Not disclosed"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Experience</dt>
                  <dd className="mt-1 font-medium text-slate-900">{experienceLabel(job)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Education</dt>
                  <dd className="mt-1 font-medium text-slate-900">{job.education_level ?? "Not specified"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Openings</dt>
                  <dd className="mt-1 font-medium text-slate-900">{job.openings}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Published</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {formatDateOnlyKarachi(job.published_at ?? job.created_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</dt>
                  <dd className="mt-1 font-medium text-slate-900">{locationLabel}</dd>
                </div>
              </dl>

              <Section title="Job description">
                <p className="whitespace-pre-line leading-relaxed">{job.description}</p>
              </Section>

              {job.responsibilities && (
                <Section title="Responsibilities">
                  <p className="whitespace-pre-line leading-relaxed">{job.responsibilities}</p>
                </Section>
              )}

              {job.qualifications && (
                <Section title="Qualifications">
                  <p className="whitespace-pre-line leading-relaxed">{job.qualifications}</p>
                </Section>
              )}

              {job.skills.length > 0 && (
                <Section title="Skills">
                  <div className="flex flex-wrap gap-2">
                    {job.skills.map((s) => (
                      <Badge key={s} tone="neutral">{s}</Badge>
                    ))}
                  </div>
                </Section>
              )}

              {questions.length > 0 && (
                <Section title="Application questions">
                  <p className="text-sm text-slate-500">
                    The employer will ask these when you apply:
                  </p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">
                    {questions.map((q) => (
                      <li key={q.id}>
                        {q.question}
                        {q.is_required && <span className="ml-1 text-xs text-slate-400">(required)</span>}
                      </li>
                    ))}
                  </ol>
                </Section>
              )}
            </CardContent>
          </Card>

          {similarJobs.length > 0 && (
            <section className="mt-10">
              <h2 className="text-xl font-bold text-slate-900">Similar jobs</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {similarJobs.map((j) => (
                  <JobCard key={j.id} job={j} />
                ))}
              </div>
            </section>
          )}
        </article>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Apply for this role</CardTitle>
            </CardHeader>
            <CardContent>
              {job.deadline ? (
                <p className="text-sm text-slate-600">
                  Applications close on{" "}
                  <strong className="text-slate-900">{formatDateOnlyKarachi(job.deadline)}</strong>.
                </p>
              ) : (
                <p className="text-sm text-slate-600">Applications are open — no closing date set.</p>
              )}
              <Link
                href={applyHref}
                className="mt-4 block rounded-md bg-brand-600 px-4 py-2.5 text-center font-semibold text-white hover:bg-brand-700"
              >
                {user ? "Go to your dashboard to apply" : "Log in to apply"}
              </Link>
              {!user && (
                <p className="mt-2 text-center text-sm text-slate-500">
                  New here?{" "}
                  <Link href={`/register?type=candidate&next=${encodeURIComponent(`/jobs/${job.slug}`)}`} className="font-semibold text-brand-700 hover:underline">
                    Create a free account
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          {job.org && (
            <Card>
              <CardHeader>
                <CardTitle>About the employer</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/companies/${job.org.slug}`} className="font-semibold text-brand-700 hover:underline">
                  {job.org.name}
                </Link>
                {job.org.verification_status === "verified" && (
                  <p className="mt-1 text-xs font-medium text-emerald-700">✓ Verified employer</p>
                )}
                {job.org.industry && <p className="mt-1 text-sm text-slate-600">{job.org.industry}</p>}
                {job.org.about && (
                  <p className="mt-2 line-clamp-4 text-sm text-slate-600">{job.org.about}</p>
                )}
                {job.org.website && (
                  <a
                    href={job.org.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline"
                  >
                    Visit website ↗
                  </a>
                )}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </main>
  );
}
