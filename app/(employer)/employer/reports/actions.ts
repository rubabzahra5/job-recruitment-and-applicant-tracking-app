"use server";

import { z } from "zod";
import { requireSessionUser } from "@/lib/auth";
import { requireOrgRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { exportScopedCsv, type CsvColumn } from "@/lib/csv";
import { loadPipeline, type PipelineLoader } from "@/lib/pipeline";
import { formatDateOnlyKarachi } from "@/lib/format";
import {
  getAssignedApplicationIds,
  canViewSalary,
  okResult,
  failResult,
  type ActionResult,
} from "../../_lib/org";

const filtersSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  jobId: z.string().optional(),
});

export type ReportFilters = z.infer<typeof filtersSchema>;
export type CsvExportResult = ActionResult & { csv?: string; filename?: string };

interface ReportRow {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  department: string;
  stage: string;
  submittedAt: string;
  hiredAt: string | null;
  daysToHire: number | null;
  salaryAmount: number | null;
}

async function loadReportRows(orgId: string, filters: ReportFilters, role: string, userId: string): Promise<ReportRow[]> {
  const admin = createAdminClient();
  const pipeline = await loadPipeline(admin as unknown as PipelineLoader);
  const stageLabel = (k: string) => pipeline.stages.find((s) => s.key === k)?.label ?? k;

  const from = filters.from ? new Date(`${filters.from}T00:00:00+05:00`) : null;
  const to = filters.to ? new Date(`${filters.to}T23:59:59+05:00`) : null;

  let query = admin
    .from("applications")
    .select("id,user_id,stage,submitted_at,jobs(id,title,departments(name))")
    .eq("org_id", orgId)
    .order("submitted_at", { ascending: false })
    .limit(2000);
  if (filters.jobId) query = query.eq("job_id", filters.jobId);
  const { data: applications, error } = await query;
  if (error) throw new Error(`Failed to load applications: ${error.message}`);

  let apps = (applications ?? []) as unknown as Array<{
    id: string; user_id: string; stage: string; submitted_at: string;
    jobs: { title: string; departments: { name: string } | null } | null;
  }>;
  if (role === "hiring_manager") {
    const assigned = await getAssignedApplicationIds(userId);
    apps = apps.filter((a) => assigned.has(a.id));
  }
  apps = apps.filter((a) => {
    const s = new Date(a.submitted_at);
    if (from && !Number.isNaN(from.getTime()) && s < from) return false;
    if (to && !Number.isNaN(to.getTime()) && s > to) return false;
    return true;
  });

  const userIds = [...new Set(apps.map((a) => a.user_id))];
  const { data: profiles } = userIds.length > 0
    ? await admin.from("candidate_profiles").select("user_id,full_name").in("user_id", userIds)
    : { data: [] as { user_id: string; full_name: string }[] };
  const nameByUser = new Map((profiles ?? []).map((p) => [p.user_id as string, p.full_name as string]));

  const hiredIds = apps.filter((a) => a.stage === "hired").map((a) => a.id);
  const { data: hires } = hiredIds.length > 0
    ? await admin.from("hiring_records").select("application_id,hired_at").in("application_id", hiredIds)
    : { data: [] as { application_id: string; hired_at: string }[] };
  const hiredAtByApp = new Map((hires ?? []).map((h) => [h.application_id as string, h.hired_at as string]));

  const { data: offers } = hiredIds.length > 0
    ? await admin.from("offers").select("application_id,salary_amount").in("application_id", hiredIds)
    : { data: [] as { application_id: string; salary_amount: number | null }[] };
  const salaryByApp = new Map((offers ?? []).map((o) => [o.application_id as string, o.salary_amount as number | null]));

  return apps.map((a) => {
    const hiredAt = hiredAtByApp.get(a.id) ?? null;
    const daysToHire =
      hiredAt != null
        ? Math.max(0, (new Date(hiredAt).getTime() - new Date(a.submitted_at).getTime()) / 86_400_000)
        : null;
    return {
      applicationId: a.id,
      candidateName: nameByUser.get(a.user_id) ?? "Candidate",
      jobTitle: a.jobs?.title ?? "—",
      department: a.jobs?.departments?.name ?? "—",
      stage: stageLabel(a.stage),
      submittedAt: formatDateOnlyKarachi(a.submitted_at),
      hiredAt: hiredAt ? formatDateOnlyKarachi(hiredAt) : null,
      daysToHire: daysToHire != null ? Math.round(daysToHire * 10) / 10 : null,
      salaryAmount: salaryByApp.get(a.id) ?? null,
    };
  });
}

/**
 * Scoped CSV export. Authorized columns only: no candidate contact details;
 * salary columns only for org_admin/hr_manager. Bounded to 2000 rows.
 */
export async function exportReportCsv(
  orgId: string,
  report: "applications_by_stage" | "time_to_hire" | "applications_by_job",
  filters: ReportFilters,
): Promise<CsvExportResult> {
  try {
    const user = await requireSessionUser();
    const role = await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
    const parsed = filtersSchema.parse(filters);
    const rows = await loadReportRows(orgId, parsed, role, user.id);
    const showSalary = canViewSalary(role);

    let columns: CsvColumn<ReportRow>[];
    let selected: ReportRow[];
    if (report === "applications_by_stage") {
      columns = [
        { header: "Candidate", value: (r) => r.candidateName },
        { header: "Vacancy", value: (r) => r.jobTitle },
        { header: "Department", value: (r) => r.department },
        { header: "Stage", value: (r) => r.stage },
        { header: "Submitted (Asia/Karachi)", value: (r) => r.submittedAt },
      ];
      selected = rows;
    } else if (report === "time_to_hire") {
      columns = [
        { header: "Candidate", value: (r) => r.candidateName },
        { header: "Vacancy", value: (r) => r.jobTitle },
        { header: "Department", value: (r) => r.department },
        { header: "Submitted (Asia/Karachi)", value: (r) => r.submittedAt },
        { header: "Hired (Asia/Karachi)", value: (r) => r.hiredAt ?? "" },
        { header: "Days to hire", value: (r) => r.daysToHire ?? "" },
      ];
      if (showSalary) columns.push({ header: "Offer salary (PKR)", value: (r) => r.salaryAmount ?? "" });
      selected = rows.filter((r) => r.hiredAt !== null);
    } else {
      columns = [
        { header: "Vacancy", value: (r) => r.jobTitle },
        { header: "Department", value: (r) => r.department },
        { header: "Candidate", value: (r) => r.candidateName },
        { header: "Stage", value: (r) => r.stage },
        { header: "Submitted (Asia/Karachi)", value: (r) => r.submittedAt },
      ];
      selected = rows;
    }

    const csv = exportScopedCsv(selected, columns, {
      maxRows: 2000,
      scope: `org ${orgId} report ${report}`,
    });

    await writeAudit({
      actorUserId: user.id,
      action: "report.exported",
      entityType: "report",
      entityId: null,
      orgId,
      metadata: { report, rows: selected.length, filters: parsed },
    });

    return { ok: true, csv, filename: `${report}.csv` };
  } catch (e) {
    return failResult(e);
  }
}

export interface ReportData {
  rows: ReportRow[];
  stageCounts: { stage: string; count: number }[];
  avgDaysToHire: number | null;
  hires: number;
}

/** Load report data for the page (same scoping as the CSV export). */
export async function getReportData(orgId: string, filters: ReportFilters): Promise<ReportData> {
  const user = await requireSessionUser();
  const role = await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
  const parsed = filtersSchema.parse(filters);
  const rows = await loadReportRows(orgId, parsed, role, user.id);

  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.stage, (counts.get(r.stage) ?? 0) + 1);
  const hires = rows.filter((r) => r.hiredAt !== null);
  const avgDaysToHire =
    hires.length > 0
      ? hires.reduce((s, r) => s + (r.daysToHire ?? 0), 0) / hires.length
      : null;

  return {
    rows,
    stageCounts: [...counts.entries()].map(([stage, count]) => ({ stage, count })),
    avgDaysToHire,
    hires: hires.length,
  };
}

export async function getReportJobs(orgId: string) {
  const user = await requireSessionUser();
  await requireOrgRole(user.id, orgId, { atLeast: "recruiter" });
  const admin = createAdminClient();
  const { data } = await admin.from("jobs").select("id,title").eq("org_id", orgId).order("title");
  return (data ?? []).map((j) => ({ id: j.id as string, title: j.title as string }));
}
