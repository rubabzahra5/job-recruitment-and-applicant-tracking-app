import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateOnlyKarachi } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  getOrgContext,
  getAssignedApplicationIds,
  NoOrganizationError,
} from "../_lib/org";
import { NoOrgState } from "../_components/NoOrgState";
import { DashboardFilters } from "../_components/DashboardFilters";

export const metadata: Metadata = { title: "Employer Dashboard" };

interface SearchParams {
  org?: string;
  from?: string;
  to?: string;
  dept?: string;
  job?: string;
  recruiter?: string;
  stage?: string;
}

function parseDateParam(v: string | undefined, fallback: Date): Date {
  if (!v) return fallback;
  const d = new Date(`${v}T00:00:00+05:00`);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

export default async function EmployerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  let ctx;
  try {
    ctx = await getOrgContext(sp.org ?? null);
  } catch (e) {
    if (e instanceof NoOrganizationError) return <NoOrgState />;
    throw e;
  }

  const admin = createAdminClient();
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 86_400_000);
  const from = parseDateParam(sp.from, defaultFrom);
  const to = parseDateParam(sp.to, now);
  to.setHours(23, 59, 59, 999);

  const isHiringManager = ctx.role === "hiring_manager";
  const assignedIds = isHiringManager ? await getAssignedApplicationIds(ctx.user.id) : null;

  // ── load org data ──────────────────────────────────────────────────
  const appIdsRes = await admin.from("applications").select("id").eq("org_id", ctx.orgId);
  const orgAppIds = (appIdsRes.data ?? []).map((a) => a.id as string);

  const [
    { data: jobs },
    { data: applications },
    { data: assignments },
    { data: interviews },
    { data: offers },
    { data: hires },
    { data: stages },
    { data: departments },
  ] = await Promise.all([
    admin
      .from("jobs")
      .select("id,title,status,department_id,openings,departments(name)")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false }),
    admin
      .from("applications")
      .select("id,job_id,stage,submitted_at,user_id,jobs(id,title,department_id)")
      .eq("org_id", ctx.orgId),
    orgAppIds.length > 0
      ? admin.from("application_assignments").select("application_id,assignee_user_id").in("application_id", orgAppIds)
      : Promise.resolve({ data: [] as { application_id: string; assignee_user_id: string }[] }),
    admin
      .from("interviews")
      .select("id,scheduled_at,status,application_id")
      .eq("org_id", ctx.orgId)
      .in("status", ["scheduled", "rescheduled"])
      .gte("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50),
    admin.from("offers").select("id,status,application_id").eq("org_id", ctx.orgId),
    admin
      .from("hiring_records")
      .select("id,application_id,hired_at,applications!inner(id,org_id,submitted_at,job_id)")
      .eq("applications.org_id", ctx.orgId),
    admin.from("pipeline_stages").select("key,label").order("sort_order"),
    admin.from("departments").select("id,name").eq("org_id", ctx.orgId).order("name"),
  ]);

  const jobList = (jobs ?? []) as unknown as Array<{
    id: string; title: string; status: string; department_id: string | null;
    openings: number; departments: { name: string } | null;
  }>;
  let appList = (applications ?? []) as unknown as Array<{
    id: string; job_id: string; stage: string; submitted_at: string; user_id: string;
    jobs: { id: string; title: string; department_id: string | null } | null;
  }>;

  // Hiring-manager scoping: only applications assigned to them.
  if (assignedIds) {
    appList = appList.filter((a) => assignedIds.has(a.id));
  }
  const visibleJobIds = new Set(appList.map((a) => a.job_id));
  const scopedJobs = isHiringManager ? jobList.filter((j) => visibleJobIds.has(j.id)) : jobList;

  // ── filters ────────────────────────────────────────────────────────
  const recruiterFilter = sp.recruiter ?? "";
  const assigneeByApp = new Map<string, string[]>();
  for (const a of (assignments ?? []) as unknown as Array<{ application_id: string; assignee_user_id: string }>) {
    const list = assigneeByApp.get(a.application_id) ?? [];
    list.push(a.assignee_user_id);
    assigneeByApp.set(a.application_id, list);
  }
  const filteredApps = appList.filter((a) => {
    const submitted = new Date(a.submitted_at);
    if (submitted < from || submitted > to) return false;
    if (sp.job && a.job_id !== sp.job) return false;
    if (sp.dept && a.jobs?.department_id !== sp.dept) return false;
    if (sp.stage && a.stage !== sp.stage) return false;
    if (recruiterFilter && !(assigneeByApp.get(a.id) ?? []).includes(recruiterFilter)) return false;
    return true;
  });

  // ── metrics ────────────────────────────────────────────────────────
  const activeJobs = scopedJobs.filter((j) => j.status === "published").length;
  const draftJobs = scopedJobs.filter((j) => j.status === "draft").length;
  const pendingReviewJobs = scopedJobs.filter((j) => j.status === "pending_review").length;
  const awaitingScreening = filteredApps.filter((a) =>
    ["applied", "initial_screening"].includes(a.stage),
  ).length;
  const shortlisted = filteredApps.filter((a) => a.stage === "shortlisted").length;
  const hiresCount = filteredApps.filter((a) => a.stage === "hired").length;
  const rejectedCount = filteredApps.filter((a) => a.stage === "rejected").length;
  const withdrawnCount = filteredApps.filter((a) => a.stage === "withdrawn").length;
  const upcomingInterviews = ((interviews ?? []) as unknown as Array<{ id: string; scheduled_at: string; status: string; application_id: string }>).filter(
    (i) => !assignedIds || assignedIds.has(i.application_id),
  );
  const pendingOffers = ((offers ?? []) as unknown as Array<{ id: string; status: string; application_id: string }>).filter(
    (o) => o.status === "pending_approval" && (!assignedIds || assignedIds.has(o.application_id)),
  ).length;

  // Time to hire: hired_at - submitted_at over hiring records in range.
  const hireRows = ((hires ?? []) as unknown as Array<{
    hired_at: string; applications: { submitted_at: string; job_id: string } | null; application_id: string;
  }>).filter((h) => {
    if (assignedIds && !assignedIds.has(h.application_id)) return false;
    const hAt = new Date(h.hired_at);
    return hAt >= from && hAt <= to;
  });
  const timeToHireDays = hireRows
    .map((h) => daysBetween(h.applications?.submitted_at ?? h.hired_at, h.hired_at))
    .filter((d) => d >= 0);
  const avgTimeToHire =
    timeToHireDays.length > 0
      ? timeToHireDays.reduce((s, d) => s + d, 0) / timeToHireDays.length
      : null;

  // Time to first review: first status-history entry after submission.
  let avgFirstReview: number | null = null;
  if (filteredApps.length > 0 && filteredApps.length <= 2000) {
    const { data: history } = await admin
      .from("application_status_history")
      .select("application_id,created_at")
      .in("application_id", filteredApps.map((a) => a.id))
      .order("created_at", { ascending: true });
    const firstByApp = new Map<string, string>();
    for (const h of (history ?? []) as unknown as Array<{ application_id: string; created_at: string }>) {
      if (!firstByApp.has(h.application_id)) firstByApp.set(h.application_id, h.created_at);
    }
    const diffs = filteredApps
      .map((a) => {
        const first = firstByApp.get(a.id);
        return first ? daysBetween(a.submitted_at, first) : null;
      })
      .filter((d): d is number => d !== null && d >= 0);
    avgFirstReview = diffs.length > 0 ? diffs.reduce((s, d) => s + d, 0) / diffs.length : null;
  }

  // Fill rate = hired applications ÷ published jobs that have openings.
  const publishedWithOpenings = scopedJobs.filter(
    (j) => j.status === "published" && (j.openings ?? 1) >= 1,
  ).length;
  const fillRate =
    publishedWithOpenings > 0 ? (hiresCount / publishedWithOpenings) * 100 : null;

  // Stage breakdown for the funnel.
  const stageCounts = new Map<string, number>();
  for (const a of filteredApps) stageCounts.set(a.stage, (stageCounts.get(a.stage) ?? 0) + 1);

  // Recruiter filter options (org staff with assignments).
  const recruiterIds = [...new Set((assignments ?? []).map((a) => (a as { assignee_user_id: string }).assignee_user_id))];
  let recruiterOptions: { userId: string; name: string }[] = [];
  if (recruiterIds.length > 0) {
    const { data: profs } = await admin.from("profiles").select("id,display_name,email").in("id", recruiterIds);
    recruiterOptions = (profs ?? []).map((p) => ({
      userId: p.id as string,
      name: (p.display_name as string | null) ?? (p.email as string),
    }));
  }

  const orgParam = ctx.orgId ? `?org=${encodeURIComponent(ctx.orgId)}` : "";

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{ctx.org.name} — Hiring dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatDateOnlyKarachi(from)} – {formatDateOnlyKarachi(to)} · Role: {ctx.role.replace("_", " ")}
            {isHiringManager && " · scoped to your assigned vacancies"}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <DashboardFilters
          options={{
            departments: (departments ?? []).map((d) => ({ id: d.id as string, name: d.name as string })),
            jobs: scopedJobs.map((j) => ({ id: j.id, title: j.title })),
            recruiters: recruiterOptions,
            stages: (stages ?? []).map((s) => ({ key: s.key as string, label: s.label as string })),
          }}
        />
      </div>

      <section aria-label="Pipeline metrics" className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active jobs" value={activeJobs} hint="Published vacancies" />
        <Stat label="Total applications" value={filteredApps.length} hint="In selected period" />
        <Stat label="Awaiting screening" value={awaitingScreening} hint="Applied + initial screening" />
        <Stat label="Shortlisted" value={shortlisted} />
        <Stat label="Upcoming interviews" value={upcomingInterviews.length} />
        <Stat label="Offers pending approval" value={pendingOffers} />
        <Stat label="Hires" value={hiresCount} hint="In selected period" />
        <Stat label="Rejected / withdrawn" value={`${rejectedCount} / ${withdrawnCount}`} />
      </section>

      <section aria-label="Efficiency metrics" className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Avg. time to hire"
          value={avgTimeToHire !== null ? `${avgTimeToHire.toFixed(1)} days` : "—"}
          hint="hired_at − submitted_at, per hire"
        />
        <Stat
          label="Avg. time to first review"
          value={avgFirstReview !== null ? `${avgFirstReview.toFixed(1)} days` : "—"}
          hint="submission → first stage change"
        />
        <Stat
          label="Fill rate"
          value={fillRate !== null ? `${fillRate.toFixed(0)}%` : "—"}
          hint="Hires ÷ published jobs with openings"
        />
        <Stat label="Draft / pending review jobs" value={`${draftJobs} / ${pendingReviewJobs}`} />
      </section>

      <p className="mt-3 text-xs text-slate-500">
        Definitions — <strong>Time to hire</strong>: days from application submission to the hiring record, averaged
        over hires in the period. <strong>Time to first review</strong>: days from submission to the first pipeline
        stage change. <strong>Fill rate</strong>: hired applications in the period ÷ jobs currently published with at
        least one opening (can exceed 100% when one vacancy yields multiple hires). All timestamps stored in UTC,
        displayed in Asia/Karachi.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {(stages ?? []).map((s) => {
                const key = s.key as string;
                const count = stageCounts.get(key) ?? 0;
                const pct = filteredApps.length > 0 ? Math.round((count / filteredApps.length) * 100) : 0;
                return (
                  <li key={key} className="flex items-center gap-2 text-sm">
                    <span className="w-36 shrink-0 truncate text-slate-600">{s.label as string}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
                      <span className="block h-full rounded bg-brand-500" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-16 text-right font-medium tabular-nums">{count}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming interviews</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingInterviews.length === 0 ? (
              <EmptyState
                title="No upcoming interviews"
                description="Scheduled interviews will appear here."
                action={<Link href={`/employer/interviews${orgParam}`} className="text-sm font-medium text-brand-700 hover:underline">Schedule an interview</Link>}
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcomingInterviews.slice(0, 8).map((i) => (
                  <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                    <Link href={`/employer/interviews${orgParam}`} className="text-brand-700 hover:underline">
                      {formatDateOnlyKarachi(i.scheduled_at)}
                    </Link>
                    <Badge tone="info">{i.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
