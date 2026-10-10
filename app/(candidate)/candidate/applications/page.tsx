import type { Metadata } from "next";
import Link from "next/link";
import { requireCandidate } from "@/app/(candidate)/_lib/candidate-guard";
import { StageBadge, stageLabel } from "@/app/(candidate)/_components/StageBadge";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateKarachi } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "My Applications" };

interface PageProps {
  searchParams: Promise<{ stage?: string }>;
}

interface ApplicationRow {
  id: string;
  stage: string;
  submitted_at: string;
  withdrawn_at: string | null;
  job: {
    title: string;
    slug: string;
    org: { name: string } | null;
    location: { city: string } | null;
  } | null;
}

const STAGE_FILTERS = [
  "applied",
  "initial_screening",
  "shortlisted",
  "assessment",
  "interview_scheduled",
  "interview_completed",
  "reference_check",
  "offer_pending",
  "offer_accepted",
  "offer_declined",
  "hired",
  "rejected",
  "withdrawn",
];

export default async function ApplicationsPage({ searchParams }: PageProps) {
  const user = await requireCandidate();
  const { stage } = await searchParams;
  const admin = createAdminClient();

  const validStage = stage && STAGE_FILTERS.includes(stage) ? stage : null;

  let query = admin
    .from("applications")
    .select("id,stage,submitted_at,withdrawn_at,job:jobs(title,slug,org:organizations(name),location:locations(city))")
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false });
  if (validStage) query = query.eq("stage", validStage);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load applications: ${error.message}`);
  const applications = (data ?? []) as unknown as ApplicationRow[];

  // Counts per stage for the filter bar (own applications only).
  const { data: allStages } = await admin
    .from("applications")
    .select("stage")
    .eq("user_id", user.id);
  const counts = new Map<string, number>();
  for (const r of (allStages ?? []) as Array<{ stage: string }>) {
    counts.set(r.stage, (counts.get(r.stage) ?? 0) + 1);
  }
  const totalCount = (allStages ?? []).length;

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My applications</h1>
          <p className="mt-1 text-sm text-slate-600">
            Track every application and its hiring stage.
          </p>
        </div>
        <Link href="/jobs">
          <Button variant="primary">Find jobs</Button>
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter by stage">
        <Link
          href="/candidate/applications"
          aria-current={!validStage ? "page" : undefined}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            !validStage ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          All ({totalCount})
        </Link>
        {STAGE_FILTERS.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => (
          <Link
            key={s}
            href={`/candidate/applications?stage=${s}`}
            aria-current={validStage === s ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              validStage === s ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {stageLabel(s)} ({counts.get(s)})
          </Link>
        ))}
      </div>

      <div className="mt-4">
        {applications.length === 0 ? (
          <EmptyState
            title={validStage ? `No ${stageLabel(validStage).toLowerCase()} applications` : "No applications yet"}
            description="When you apply to jobs, they'll show up here with live status updates."
            action={
              <Link href="/jobs">
                <Button variant="primary" size="sm">Browse jobs</Button>
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3">
            {applications.map((app) => (
              <li key={app.id}>
                <Link
                  href={`/candidate/applications/${app.id}`}
                  className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-slate-900">
                        {app.job?.title ?? "Job"}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-600">
                        {app.job?.org?.name ?? ""}
                        {app.job?.location?.city ? ` · ${app.job.location.city}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Applied {formatDateKarachi(app.submitted_at, { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <StageBadge stage={app.stage} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
