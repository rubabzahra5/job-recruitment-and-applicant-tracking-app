import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminDeniedError, adminPageGuard } from "@/app/(admin)/_components/admin-server";
import { AdminDenied } from "@/app/(admin)/_components/AdminDenied";
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
import { formatDateKarachi, formatSalaryRange } from "@/lib/format";

export const metadata: Metadata = { title: "Control Center — Job detail" };
export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let admin;
  try {
    ({ admin } = await adminPageGuard(`/control-center/jobs/${id}`));
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }

  const { data: job, error } = await admin
    .from("jobs")
    .select(
      "*,org:organizations(name,slug,account_status),cat:job_categories(name),loc:locations(city,province)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load job: ${error.message}`);
  if (!job) notFound();

  const [approvalsRes, appsRes] = await Promise.all([
    admin
      .from("job_approvals")
      .select("id,decision,note,created_at,decider:profiles(email)")
      .eq("job_id", id)
      .order("created_at", { ascending: false }),
    admin.from("applications").select("stage").eq("job_id", id),
  ]);

  const stageCounts = new Map<string, number>();
  for (const a of appsRes.data ?? []) {
    const s = a.stage as string;
    stageCounts.set(s, (stageCounts.get(s) ?? 0) + 1);
  }
  const org = job.org as { name?: string; account_status?: string } | null;
  const cat = job.cat as { name?: string } | null;
  const loc = job.loc as { city?: string; province?: string } | null;

  return (
    <main className="space-y-6">
      <div>
        <Link href="/control-center/jobs" className="text-sm text-brand-700 hover:underline">
          ← Jobs
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{job.title as string}</h1>
          <Badge tone="info">{job.status as string}</Badge>
          {org?.account_status !== "active" && (
            <Badge tone="danger">org {org?.account_status} — hidden from public</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {org?.name ?? "—"} · {cat?.name ?? "—"} · {loc ? `${loc.city}, ${loc.province}` : "—"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Posting details</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Employment type</dt><dd>{job.employment_type as string}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Workplace</dt><dd>{job.workplace as string}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Salary</dt><dd>{formatSalaryRange(job.salary_min, job.salary_max, job.salary_period as string)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Openings</dt><dd>{String(job.openings)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Deadline</dt><dd>{job.deadline ? formatDateKarachi(job.deadline as string) : "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Published</dt><dd>{job.published_at ? formatDateKarachi(job.published_at as string) : "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Created</dt><dd>{formatDateKarachi(job.created_at as string)}</dd></div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Applications by stage ({(appsRes.data ?? []).length})</CardTitle></CardHeader>
          <CardContent>
            {stageCounts.size === 0 ? (
              <p className="text-sm text-slate-500">No applications yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {[...stageCounts.entries()].map(([stage, n]) => (
                  <li key={stage} className="flex items-center justify-between">
                    <span>{stage}</span>
                    <Badge tone="info">{n}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/control-center/applications?job=${id}`}
              className="mt-4 inline-block text-sm text-brand-700 hover:underline"
            >
              Browse applications →
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Moderation history</CardTitle></CardHeader>
        <CardContent>
          {(approvalsRes.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No moderation decisions recorded.</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Decision</TableHeaderCell>
                  <TableHeaderCell>Note</TableHeaderCell>
                  <TableHeaderCell>Decided by</TableHeaderCell>
                  <TableHeaderCell>When</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(approvalsRes.data ?? []).map((a) => {
                  const decider = a.decider as { email?: string } | null;
                  return (
                    <TableRow key={a.id as string}>
                      <TableCell>
                        <Badge tone={a.decision === "approved" ? "success" : "danger"}>
                          {a.decision as string}
                        </Badge>
                      </TableCell>
                      <TableCell>{(a.note as string) ?? "—"}</TableCell>
                      <TableCell className="text-xs">{decider?.email ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-slate-500">
                        {formatDateKarachi(a.created_at as string)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
