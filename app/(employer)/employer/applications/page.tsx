import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateOnlyKarachi } from "@/lib/format";
import { loadPipeline, allowedNextStages, type PipelineLoader } from "@/lib/pipeline";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  getOrgContext,
  getAssignedApplicationIds,
  NoOrganizationError,
} from "../../_lib/org";
import { NoOrgState } from "../../_components/NoOrgState";
import { StageMoveControl } from "../../_components/StageMoveControl";
import { ApplicationsTable, type ApplicationRow } from "../../_components/ApplicationsTable";
import { moveApplicationStage, bulkMoveApplications } from "./actions";

export const metadata: Metadata = { title: "Applications" };

interface SearchParams {
  org?: string;
  view?: string;
  job?: string;
  stage?: string;
  recruiter?: string;
  from?: string;
  to?: string;
  q?: string;
}

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  let ctx;
  try {
    ctx = await getOrgContext(sp.org ?? null);
  } catch (e) {
    if (e instanceof NoOrganizationError) return <NoOrgState />;
    throw e;
  }
  const admin = createAdminClient();
  const pipeline = await loadPipeline(admin as unknown as PipelineLoader);
  const view = sp.view === "table" ? "table" : "board";

  const { data: jobs } = await admin
    .from("jobs")
    .select("id,title")
    .eq("org_id", ctx.orgId)
    .order("title");
  const { data: applications } = await admin
    .from("applications")
    .select("id,job_id,stage,submitted_at,user_id,jobs(id,title)")
    .eq("org_id", ctx.orgId)
    .order("submitted_at", { ascending: false })
    .limit(2000);

  const appList = (applications ?? []) as unknown as Array<{
    id: string; job_id: string; stage: string; submitted_at: string; user_id: string;
    jobs: { id: string; title: string } | null;
  }>;

  // Hiring-manager scoping.
  const assignedIds = ctx.role === "hiring_manager" ? await getAssignedApplicationIds(ctx.user.id) : null;
  const scoped = assignedIds ? appList.filter((a) => assignedIds.has(a.id)) : appList;

  // Filters.
  const from = sp.from ? new Date(`${sp.from}T00:00:00+05:00`) : null;
  const to = sp.to ? new Date(`${sp.to}T23:59:59+05:00`) : null;
  const q = (sp.q ?? "").toLowerCase();

  const userIds = [...new Set(scoped.map((a) => a.user_id))];
  const [{ data: profiles }, { data: assignments }] = await Promise.all([
    userIds.length > 0
      ? admin.from("candidate_profiles").select("user_id,full_name,headline").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string; full_name: string; headline: string | null }[] }),
    scoped.length > 0
      ? admin.from("application_assignments").select("application_id,assignee_user_id").in("application_id", scoped.map((a) => a.id))
      : Promise.resolve({ data: [] as { application_id: string; assignee_user_id: string }[] }),
  ]);
  const profileByUser = new Map((profiles ?? []).map((p) => [p.user_id as string, p]));
  const assigneeIds = [...new Set((assignments ?? []).map((a) => a.assignee_user_id as string))];
  const { data: staffProfiles } = assigneeIds.length > 0
    ? await admin.from("profiles").select("id,display_name,email").in("id", assigneeIds)
    : { data: [] as { id: string; display_name: string | null; email: string }[] };
  const staffNameById = new Map(
    (staffProfiles ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? (p.email as string)]),
  );
  const assigneesByApp = new Map<string, string[]>();
  for (const a of (assignments ?? []) as unknown as Array<{ application_id: string; assignee_user_id: string }>) {
    const list = assigneesByApp.get(a.application_id) ?? [];
    const name = staffNameById.get(a.assignee_user_id);
    if (name) list.push(name);
    assigneesByApp.set(a.application_id, list);
  }

  const stageLabel = (key: string) => pipeline.stages.find((s) => s.key === key)?.label ?? key;

  const rows: ApplicationRow[] = scoped
    .filter((a) => {
      if (sp.job && a.job_id !== sp.job) return false;
      if (sp.stage && a.stage !== sp.stage) return false;
      if (sp.recruiter) {
        const ids = ((assignments ?? []) as unknown as Array<{ application_id: string; assignee_user_id: string }>)
          .filter((x) => x.application_id === a.id)
          .map((x) => x.assignee_user_id);
        if (!ids.includes(sp.recruiter)) return false;
      }
      const submitted = new Date(a.submitted_at);
      if (from && !Number.isNaN(from.getTime()) && submitted < from) return false;
      if (to && !Number.isNaN(to.getTime()) && submitted > to) return false;
      if (q) {
        const p = profileByUser.get(a.user_id);
        const hay = `${p?.full_name ?? ""} ${(a.jobs?.title ?? "")} ${stageLabel(a.stage)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map((a) => {
      const p = profileByUser.get(a.user_id);
      return {
        id: a.id,
        stage: a.stage,
        stageLabel: stageLabel(a.stage),
        submittedAt: a.submitted_at,
        jobTitle: a.jobs?.title ?? "—",
        candidateName: (p?.full_name as string | undefined) ?? "Candidate",
        candidateHeadline: (p?.headline as string | null) ?? null,
        assignees: assigneesByApp.get(a.id) ?? [],
      };
    });

  const baseParams = new URLSearchParams();
  baseParams.set("org", ctx.orgId);
  for (const [k, v] of Object.entries({ job: sp.job, stage: sp.stage, recruiter: sp.recruiter, from: sp.from, to: sp.to, q: sp.q })) {
    if (v) baseParams.set(k, v);
  }
  const boardHref = `/employer/applications?${new URLSearchParams({ ...Object.fromEntries(baseParams), view: "board" }).toString()}`;
  const tableHref = `/employer/applications?${new URLSearchParams({ ...Object.fromEntries(baseParams), view: "table" }).toString()}`;

  const orgParam = `org=${encodeURIComponent(ctx.orgId)}`;

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Applications</h1>
        <span className="text-sm text-slate-500">
          {rows.length} application{rows.length === 1 ? "" : "s"}
          {ctx.role === "hiring_manager" && " · assigned to you"}
        </span>
      </div>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <input type="hidden" name="org" value={ctx.orgId} />
        <input type="hidden" name="view" value={view} />
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Search
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Candidate, job…" aria-label="Search applications" className="h-9 rounded-md border border-slate-300 px-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Vacancy
          <select name="job" defaultValue={sp.job ?? ""} aria-label="Filter by vacancy" className="h-9 rounded-md border border-slate-300 px-2 text-sm">
            <option value="">All vacancies</option>
            {(jobs ?? []).map((j) => (
              <option key={j.id as string} value={j.id as string}>{j.title as string}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Stage
          <select name="stage" defaultValue={sp.stage ?? ""} aria-label="Filter by stage" className="h-9 rounded-md border border-slate-300 px-2 text-sm">
            <option value="">All stages</option>
            {pipeline.stages.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Recruiter
          <select name="recruiter" defaultValue={sp.recruiter ?? ""} aria-label="Filter by recruiter" className="h-9 rounded-md border border-slate-300 px-2 text-sm">
            <option value="">All recruiters</option>
            {[...staffNameById.entries()].map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          From
          <input type="date" name="from" defaultValue={sp.from ?? ""} aria-label="From date" className="h-9 rounded-md border border-slate-300 px-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          To
          <input type="date" name="to" defaultValue={sp.to ?? ""} aria-label="To date" className="h-9 rounded-md border border-slate-300 px-2 text-sm" />
        </label>
        <Button type="submit" variant="outline" size="sm">Apply</Button>
        <Link href={`/employer/applications?${orgParam}&view=${view}`} className="text-sm text-slate-500 hover:underline">
          Clear
        </Link>
      </form>

      <div className="mt-4 flex gap-1 border-b border-slate-200" role="tablist" aria-label="Applications view">
        <Link
          href={boardHref}
          role="tab"
          aria-selected={view === "board"}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
            view === "board" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Kanban board
        </Link>
        <Link
          href={tableHref}
          role="tab"
          aria-selected={view === "table"}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
            view === "table" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Table
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No applications" description="No applications match the current filters." />
        </div>
      ) : view === "board" ? (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-4" role="list" aria-label="Pipeline board">
          {pipeline.stages.map((stage) => {
            const cards = rows.filter((r) => r.stage === stage.key);
            return (
              <section
                key={stage.key}
                role="listitem"
                aria-label={`${stage.label} (${cards.length})`}
                className="w-64 shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-2"
              >
                <h2 className="flex items-center justify-between px-1 py-1 text-sm font-semibold">
                  {stage.label}
                  <Badge tone={stage.is_terminal ? "neutral" : "info"}>{cards.length}</Badge>
                </h2>
                <div className="mt-1 space-y-2">
                  {cards.map((r) => (
                    <article key={r.id} className="rounded-md border border-slate-200 bg-white p-2.5">
                      <Link
                        href={`/employer/applications/${r.id}?${orgParam}`}
                        className="text-sm font-medium text-brand-700 hover:underline"
                      >
                        {r.candidateName}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{r.jobTitle}</p>
                      <p className="text-xs text-slate-400">{formatDateOnlyKarachi(r.submittedAt)}</p>
                      {!stage.is_terminal && (
                        <StageMoveControl
                          orgId={ctx.orgId}
                          applicationId={r.id}
                          currentStage={r.stage}
                          allowedTargets={allowedNextStages(r.stage, pipeline.transitions).map((k) => ({
                            key: k,
                            label: stageLabel(k),
                          }))}
                          moveAction={moveApplicationStage}
                        />
                      )}
                    </article>
                  ))}
                  {cards.length === 0 && <p className="px-1 py-2 text-xs text-slate-400">Empty</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="mt-4">
          <ApplicationsTable
            orgId={ctx.orgId}
            rows={rows}
            stages={pipeline.stages.map((s) => ({ key: s.key, label: s.label }))}
            transitions={pipeline.transitions.map((t) => ({ from_key: t.from_key, to_key: t.to_key }))}
            bulkAction={bulkMoveApplications}
          />
        </div>
      )}
    </main>
  );
}
