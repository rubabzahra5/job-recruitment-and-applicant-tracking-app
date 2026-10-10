import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateOnlyKarachi, formatSalaryRange } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  getOrgContext,
  getAssignedApplicationIds,
  NoOrganizationError,
} from "../../_lib/org";
import { NoOrgState } from "../../_components/NoOrgState";
import { JobActions } from "../../_components/JobActions";
import { JOB_TRANSITIONS } from "./job-schema";
import { transitionJob, deleteJob } from "./actions";

export const metadata: Metadata = { title: "Jobs" };

const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  pending_review: "warning",
  approved: "info",
  published: "success",
  paused: "warning",
  closed: "neutral",
  rejected: "danger",
  archived: "neutral",
};

interface SearchParams {
  org?: string;
  status?: string;
  q?: string;
}

export default async function JobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  let ctx;
  try {
    ctx = await getOrgContext(sp.org ?? null);
  } catch (e) {
    if (e instanceof NoOrganizationError) return <NoOrgState />;
    throw e;
  }
  const canManage = ["org_admin", "hr_manager", "recruiter"].includes(ctx.role);
  const admin = createAdminClient();

  const { data: jobs } = await admin
    .from("jobs")
    .select(
      "id,title,status,openings,deadline,published_at,salary_min,salary_max,salary_period,salary_disclosed,departments(name)",
    )
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  const jobList = (jobs ?? []) as unknown as Array<{
    id: string; title: string; status: string; openings: number; deadline: string | null;
    published_at: string | null; salary_min: number | null; salary_max: number | null;
    salary_period: string; salary_disclosed: boolean; departments: { name: string } | null;
  }>;

  // Hiring managers see only vacancies with applications assigned to them.
  let visibleJobs = jobList;
  if (ctx.role === "hiring_manager") {
    const assigned = await getAssignedApplicationIds(ctx.user.id);
    if (assigned.size > 0) {
      const { data: apps } = await admin.from("applications").select("job_id").in("id", [...assigned]);
      const jobIds = new Set((apps ?? []).map((a) => a.job_id as string));
      visibleJobs = jobList.filter((j) => jobIds.has(j.id));
    } else {
      visibleJobs = [];
    }
  }

  const statusFilter = sp.status ?? "";
  const q = (sp.q ?? "").toLowerCase();
  const filtered = visibleJobs.filter(
    (j) =>
      (!statusFilter || j.status === statusFilter) &&
      (!q || j.title.toLowerCase().includes(q)),
  );

  // Application counts per job.
  const { data: appCounts } = await admin
    .from("applications")
    .select("job_id")
    .eq("org_id", ctx.orgId)
    .in("job_id", filtered.map((j) => j.id));
  const countByJob = new Map<string, number>();
  for (const a of appCounts ?? []) {
    const id = a.job_id as string;
    countByJob.set(id, (countByJob.get(id) ?? 0) + 1);
  }

  const orgParam = `?org=${encodeURIComponent(ctx.orgId)}`;
  const statuses = ["draft", "pending_review", "approved", "published", "paused", "closed", "rejected", "archived"];

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Jobs</h1>
        {canManage && (
          <Link href={`/employer/jobs/new${orgParam}`}>
            <Button>Post a job</Button>
          </Link>
        )}
      </div>

      <form method="get" className="mt-4 flex flex-wrap gap-2">
        <input type="hidden" name="org" value={ctx.orgId} />
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search titles…"
          aria-label="Search jobs"
          className="h-10 rounded-md border border-slate-300 px-3 text-sm"
        />
        <select name="status" defaultValue={statusFilter} aria-label="Filter by status" className="h-10 rounded-md border border-slate-300 px-2 text-sm">
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No jobs found"
            description={ctx.role === "hiring_manager" ? "No vacancies are currently assigned to you." : "Post your first vacancy to start receiving applications."}
            action={canManage ? <Link href={`/employer/jobs/new${orgParam}`}><Button>Post a job</Button></Link> : undefined}
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {filtered.map((j) => (
            <div key={j.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold">{j.title}</h2>
                    <Badge tone={STATUS_TONE[j.status] ?? "neutral"}>{j.status.replace("_", " ")}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {j.departments?.name ?? "No department"} · {j.openings} opening{j.openings === 1 ? "" : "s"} ·{" "}
                    {countByJob.get(j.id) ?? 0} application{(countByJob.get(j.id) ?? 0) === 1 ? "" : "s"}
                    {j.salary_disclosed && ` · ${formatSalaryRange(j.salary_min, j.salary_max, j.salary_period)}`}
                    {j.deadline && ` · Deadline ${formatDateOnlyKarachi(j.deadline)}`}
                  </p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2">
                    {["draft", "rejected", "approved"].includes(j.status) && (
                      <Link href={`/employer/jobs/${j.id}/edit${orgParam}`}>
                        <Button variant="outline" size="sm">Edit</Button>
                      </Link>
                    )}
                    <Link href={`/employer/applications${orgParam}&job=${j.id}`}>
                      <Button variant="ghost" size="sm">View applicants</Button>
                    </Link>
                  </div>
                )}
              </div>
              {canManage && (JOB_TRANSITIONS[j.status] ?? []).length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <JobActions
                    jobId={j.id}
                    orgId={ctx.orgId}
                    currentStatus={j.status}
                    allowedTargets={JOB_TRANSITIONS[j.status] ?? []}
                    transitionAction={transitionJob}
                    deleteAction={deleteJob}
                    compact
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
