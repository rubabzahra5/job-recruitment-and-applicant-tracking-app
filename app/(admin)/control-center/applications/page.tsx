import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  AdminDeniedError,
  adminPageGuard,
  applyDateRange,
  asRows,
  firstParam,
  getPagination,
  loadPipelineAdmin,
  parseDateRange,
} from "@/app/(admin)/_components/admin-server";
import { AdminDenied } from "@/app/(admin)/_components/AdminDenied";
import { FilterBar, PaginationNav } from "@/app/(admin)/_components/filters";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { allowedNextStages } from "@/lib/pipeline";
import { formatDateKarachi } from "@/lib/format";
import { StageChangeDialog } from "./StageChangeDialog";

export const metadata: Metadata = { title: "Control Center — Applications" };
export const dynamic = "force-dynamic";

interface ApplicationRow {
  id: string;
  stage: string;
  submitted_at: string;
  profile: { email?: string } | null;
  job: { id?: string; title?: string } | null;
  org: { name?: string } | null;
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let admin;
  try {
    ({ admin } = await adminPageGuard("/control-center/applications"));
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }
  const { page, perPage, from, to } = getPagination(params);
  const range = parseDateRange(params);
  const orgId = firstParam(params.org) ?? "";
  const jobId = firstParam(params.job) ?? "";
  const stage = firstParam(params.stage) ?? "";

  const { stages, transitions } = await loadPipelineAdmin(admin);
  const stageOptions = stages.map((s) => ({ value: s.key, label: s.label }));

  let query = admin
    .from("applications")
    .select(
      "id,stage,submitted_at,profile:profiles!applications_user_id_fkey(email)," +
        "job:jobs(id,title),org:organizations(id,name)",
      { count: "exact" },
    )
    .order("submitted_at", { ascending: false });
  query = applyDateRange(query, range, "submitted_at");
  if (orgId) query = query.eq("org_id", orgId);
  if (jobId) query = query.eq("job_id", jobId);
  if (stage) query = query.eq("stage", stage);
  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(`Failed to load applications: ${error.message}`);
  const apps = asRows<ApplicationRow>(data);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));

  const [orgsRes, jobsRes] = await Promise.all([
    admin.from("organizations").select("id,name").order("name").limit(200),
    orgId
      ? admin.from("jobs").select("id,title").eq("org_id", orgId).order("created_at", { ascending: false }).limit(200)
      : admin.from("jobs").select("id,title").order("created_at", { ascending: false }).limit(200),
  ]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Applications — cross-org browser</h1>
        <p className="mt-1 text-sm text-slate-600">
          {count ?? 0} applications. Read-mostly; stage changes are pipeline-validated and audited.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Suspense>
            <FilterBar
              fields={[
                {
                  key: "org",
                  label: "Organization",
                  type: "select",
                  options: (orgsRes.data ?? []).map((o) => ({ value: o.id as string, label: o.name as string })),
                },
                {
                  key: "job",
                  label: "Job",
                  type: "select",
                  options: (jobsRes.data ?? []).map((j) => ({ value: j.id as string, label: (j.title as string).slice(0, 60) })),
                },
                { key: "stage", label: "Stage", type: "select", options: stageOptions },
                { key: "from", label: "From", type: "date" },
                { key: "to", label: "To", type: "date" },
              ]}
            />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Applications</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Candidate</TableHeaderCell>
                <TableHeaderCell>Job</TableHeaderCell>
                <TableHeaderCell>Organization</TableHeaderCell>
                <TableHeaderCell>Stage</TableHeaderCell>
                <TableHeaderCell>Submitted</TableHeaderCell>
                <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {apps.map((a) => {
                const id = a.id as string;
                const fromStage = a.stage as string;
                const profile = a.profile as { email?: string } | null;
                const job = a.job as { id?: string; title?: string } | null;
                const org = a.org as { name?: string } | null;
                const next = allowedNextStages(fromStage, transitions)
                  .map((k) => stages.find((s) => s.key === k))
                  .filter((s): s is (typeof stages)[number] => Boolean(s))
                  .map((s) => ({ key: s.key, label: s.label }));
                return (
                  <TableRow key={id}>
                    <TableCell className="text-xs">{profile?.email ?? "—"}</TableCell>
                    <TableCell>
                      {job?.id ? (
                        <Link href={`/control-center/jobs/${job.id}`} className="text-brand-700 hover:underline">
                          {job.title ?? "—"}
                        </Link>
                      ) : (
                        job?.title ?? "—"
                      )}
                    </TableCell>
                    <TableCell>{org?.name ?? "—"}</TableCell>
                    <TableCell><Badge tone="info">{fromStage}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500">
                      {formatDateKarachi(a.submitted_at as string)}
                    </TableCell>
                    <TableCell>
                      <StageChangeDialog applicationId={id} fromStage={fromStage} allowedStages={next} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Suspense>
            <PaginationNav page={page} totalPages={totalPages} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
