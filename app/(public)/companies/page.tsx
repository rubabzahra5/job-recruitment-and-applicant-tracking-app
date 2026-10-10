import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  getLiveJobCounts,
  getVerifiedOrgs,
  publicClient,
} from "../_lib/public-data";

export const metadata: Metadata = {
  title: "Companies",
  description: "Verified employers hiring across Pakistan.",
};

export default async function CompaniesPage() {
  const db = await publicClient();
  const [orgs, counts] = await Promise.all([getVerifiedOrgs(db, 200), getLiveJobCounts(db)]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Companies</h1>
      <p className="mt-1 text-slate-600">
        {orgs.length === 0
          ? "Verified employer profiles are on their way."
          : `${orgs.length} verified ${orgs.length === 1 ? "employer" : "employers"} on Job Recruitment And Applicant Tracking System.`}
      </p>

      {orgs.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((o) => {
            const jobCount = counts.byOrg.get(o.id) ?? 0;
            return (
              <Link key={o.slug} href={`/companies/${o.slug}`}>
                <Card className="flex h-full flex-col p-5 transition-shadow hover:shadow-md">
                  <div className="flex items-center gap-4">
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
                      <p className="text-sm text-slate-500">{o.industry ?? "Employer"}</p>
                    </div>
                  </div>
                  {o.about && <p className="mt-3 line-clamp-3 text-sm text-slate-600">{o.about}</p>}
                  <p className="mt-3 text-sm font-medium text-brand-700">
                    {jobCount} open role{jobCount === 1 ? "" : "s"} →
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState
            title="No verified employers yet"
            description="Employer verification is underway. Browse live jobs in the meantime."
            action={
              <Link
                href="/jobs"
                className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
              >
                Browse jobs
              </Link>
            }
          />
        </div>
      )}
    </main>
  );
}
