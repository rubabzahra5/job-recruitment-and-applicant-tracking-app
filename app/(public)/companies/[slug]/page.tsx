import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { JobCard } from "../../_components/JobCard";
import {
  getVerifiedOrgBySlug,
  publicClient,
  searchJobs,
} from "../../_lib/public-data";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const db = await publicClient();
  const org = await getVerifiedOrgBySlug(db, slug);
  if (!org) return { title: "Company not found" };
  return {
    title: `${org.name} — Jobs & Company Profile`,
    description: org.about?.slice(0, 160) ?? `Open roles at ${org.name}.`,
  };
}

export default async function CompanyDetailPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const db = await publicClient();
  const org = await getVerifiedOrgBySlug(db, slug);
  // 404 for missing, unverified, or inactive organizations.
  if (!org) notFound();

  const result = await searchJobs(db, { orgId: org.id, sort: "newest", perPage: 50 });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href="/companies" className="hover:text-brand-700 hover:underline">Companies</Link>
        <span aria-hidden="true" className="mx-2">/</span>
        <span aria-current="page" className="text-slate-700">{org.name}</span>
      </nav>

      <Card className="mt-4">
        <CardContent className="pt-6">
          <div className="flex items-start gap-5">
            {org.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url} alt={`${org.name} logo`} className="h-20 w-20 rounded-lg border border-slate-200 object-contain" />
            ) : (
              <div aria-hidden="true" className="flex h-20 w-20 items-center justify-center rounded-lg bg-brand-900 text-3xl font-bold text-white">
                {org.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
                {org.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone="success">✓ Verified employer</Badge>
                {org.industry && <Badge tone="neutral">{org.industry}</Badge>}
                {org.size_range && <Badge tone="neutral">{org.size_range} employees</Badge>}
              </div>
              {org.website && (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline"
                >
                  {org.website.replace(/^https?:\/\//, "")} ↗
                </a>
              )}
            </div>
          </div>
          {org.about && (
            <div className="mt-6">
              <h2 className="text-lg font-bold text-slate-900">About {org.name}</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{org.about}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="mt-10" aria-label={`Open roles at ${org.name}`}>
        <h2 className="text-xl font-bold text-slate-900">
          Open roles <span className="text-slate-500">({result.total})</span>
        </h2>
        {result.jobs.length > 0 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {result.jobs.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              title="No open roles right now"
              description={`${org.name} has no live vacancies at the moment. Check back soon.`}
              action={
                <Link
                  href="/jobs"
                  className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Browse all jobs
                </Link>
              }
            />
          </div>
        )}
      </section>

      <Card className="mt-10">
        <CardHeader>
          <CardTitle>Work at {org.name}?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            Create a free candidate account to apply and get notified when {org.name} posts new roles.
          </p>
          <Link
            href="/register?type=candidate"
            className="mt-3 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Create free account
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
